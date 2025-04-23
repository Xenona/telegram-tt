import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';
import { ApiMessageEntityTypes } from '../../../api/types';

import { EDITABLE_INPUT_ID } from '../../../config';
import { ensureProtocol } from '../../../util/browser/url';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import getKeyFromEvent from '../../../util/getKeyFromEvent';
import { selectAfterNode } from '../../../util/selection';
import stopEvent from '../../../util/stopEvent';
import { type RichInputCtx, useRichEditableKeyboardListener } from './useRichEditable';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';

import Button from '../../ui/Button';
import Icon from '../icons/Icon';
import { RichInputKeyboardPriority } from './Keyboard';

import './TextFormatter.scss';
import { isBlockquote } from './BlockquoteEnter';

export type OwnProps = {
  richInputCtx: RichInputCtx;
  isOpen: boolean;
  isActive: boolean;
  onClose: () => void;
};

interface ISelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
  spoiler?: boolean;
  quote?: boolean;
}

const TEXT_FORMAT_BY_TAG_NAME: Record<string, keyof ISelectedTextFormats> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  DEL: 'strikethrough',
  STRIKE: 'strikethrough',
  CODE: 'monospace',
  SPAN: 'spoiler',
  BLOCKQUOTE: 'quote',
};

const TEXT_FORMATTER_SAFE_AREA_PX = 180;

const TextFormatter: FC<OwnProps> = ({
  richInputCtx,
  isOpen: shouldOpen,
  isActive,
  onClose,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const isOpen = isActive && (shouldOpen || isEditingLink);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen || isLinkControlOpen);
  const [linkUrl, setLinkUrl] = useState('');
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});
  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    if (isLinkControlOpen) {
      linkUrlInputRef.current!.focus();
    } else {
      setLinkUrl('');
      setIsEditingLink(false);
    }
  }, [isLinkControlOpen, linkUrlInputRef]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      setSelectedTextFormats({});
      setInputClassName(undefined);
    }
  }, [closeLinkControl, shouldRender]);

  useEffect(() => {
    const sel = richInputCtx.editable.selectionS();
    if (!isOpen || !sel) {
      return;
    }

    const selectedFormats: ISelectedTextFormats = {};
    let formNode: Node | null = sel.range.commonAncestorContainer;
    while (formNode && formNode !== richInputCtx.editable.root) {
      const textFormat = (formNode && ("tagName" in formNode)) ? TEXT_FORMAT_BY_TAG_NAME[formNode.tagName as string] : null;
      if (textFormat) {
        selectedFormats[textFormat] = true;
      }

      formNode = formNode.parentElement;
    }

    setSelectedTextFormats(selectedFormats);
  }, [isOpen, richInputCtx.editable, richInputCtx.editable.selectionS, openLinkControl]);

  const linkSelSaver = useRef<Range | undefined>();
  const startLinkControl = useLastCallback(() => {
    const sel = richInputCtx.editable.selectionS();

    if (!sel || sel.collapsed) return;
    linkSelSaver.current = sel.range.cloneRange();
    openLinkControl();
  });

  const getSelectedElement = useLastCallback(() => {
    const sel = richInputCtx.editable.selectionS();
    if (!sel) {
      return undefined;
    }

    return sel.range.commonAncestorContainer.parentElement;
  });

  function updateInputStyles() {
    const input = linkUrlInputRef.current;
    if (!input) {
      return;
    }

    const { offsetWidth, scrollWidth, scrollLeft } = input;
    if (scrollWidth <= offsetWidth) {
      setInputClassName(undefined);
      return;
    }

    let className = '';
    if (scrollLeft < scrollWidth - offsetWidth) {
      className = 'mask-right';
    }
    if (scrollLeft > 0) {
      className += ' mask-left';
    }

    setInputClassName(className);
  }

  function handleLinkUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLinkUrl(e.target.value);
    updateInputStyles();
  }

  function getFormatButtonClassName(key: keyof ISelectedTextFormats) {
    if (selectedTextFormats[key]) {
      return 'active';
    }

    if (key === 'monospace') {
      if (Object.keys(selectedTextFormats).some(
        (fKey) => fKey !== key && Boolean(selectedTextFormats[fKey as keyof ISelectedTextFormats]),
      )) {
        return 'disabled';
      }
    } else if (selectedTextFormats.monospace) {
      return 'disabled';
    }

    return undefined;
  }

  const handleSpoilerText = useLastCallback(() => {
    if (selectedTextFormats.spoiler) {
      const element = getSelectedElement();
      if (
        !richInputCtx.editable.selectionS()
        || !element
        || element.dataset.entityType !== ApiMessageEntityTypes.Spoiler
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        spoiler: false,
      }));

      return;
    }

    const text = richInputCtx.editable.getSelectedHtml();
    if (!text) return;
    richInputCtx.editable.execCommand(
      'insertHTML', `<span class="spoiler" data-entity-type="${ApiMessageEntityTypes.Spoiler}">${text}</span>`,
    );
    onClose();
  });

  const handleBoldText = useLastCallback(() => {
    setSelectedTextFormats((selectedFormats) => {
      // Somehow re-applying 'bold' command to already bold text doesn't work
      richInputCtx.editable.execCommand('bold');
      return {
        ...selectedFormats,
        bold: !selectedFormats.bold,
      };
    });
  });

  const handleItalicText = useLastCallback(() => {
    richInputCtx.editable.execCommand('italic');
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      italic: !selectedFormats.italic,
    }));
  });

  const handleUnderlineText = useLastCallback(() => {
    richInputCtx.editable.execCommand('underline');
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      underline: !selectedFormats.underline,
    }));
  });

  const handleStrikethroughText = useLastCallback(() => {
    richInputCtx.editable.execCommand('strikethrough');
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      strikethrough: !selectedFormats.strikethrough,
    }));
  });

  const handleMonospaceText = useLastCallback(() => {
    if (window.getSelection()?.isCollapsed) return;

    if (selectedTextFormats.monospace) {
      richInputCtx.editable.execCommand('removeFormat');
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        monospace: false,
      }));
      return;
    }

    const previousCode = [...(richInputCtx.editable.root.querySelectorAll('code') || [])];
    const text = richInputCtx.editable.selectionS()?.range?.toString() || '';
    if (!text) return;
    richInputCtx.editable.execCommand(
      'insertHTML',
      `<code class="text-entity-code" dir="auto">${text}</code>`,
    );

    requestMutation(() => {
      const currentCode = richInputCtx.editable.root?.querySelectorAll('code') || [];
      for (const el of currentCode) {
        if (previousCode.includes(el)) continue;
        selectAfterNode(el);
      }
      onClose();
    });
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    const formattedLinkUrl = (ensureProtocol(linkUrl) || '').split('%').map(encodeURI).join('%');

    if (linkSelSaver.current) {
      richInputCtx.editable.setSelRange(linkSelSaver.current);
    }

    if (isEditingLink) {
      const element = getSelectedElement();
      if (!element || element.tagName !== 'A') {
        return;
      }

      (element as HTMLAnchorElement).href = formattedLinkUrl;

      onClose();

      return;
    }

    const text = richInputCtx.editable.getSelectedHtml({ shouldDropCustomEmoji: true });
    richInputCtx.editable.execCommand(
      'insertHTML',
      `<a href=${formattedLinkUrl} class="text-entity-link" dir="auto">${text}</a>`,
    );
    closeLinkControl();
    onClose();
  });

  const handleQuote = useLastCallback(() => {
    if (selectedTextFormats.quote) {
      const selection = window.getSelection();
      if (!selection) return;
      const r = selection.getRangeAt(0)
      let element: Node | null = r.commonAncestorContainer;
      
      while(element && !isBlockquote(element)) {
        element = element.parentElement;
      }

      if (
        !richInputCtx.editable.selectionS()
        || !element
        || !isBlockquote(element)
        || !element.textContent
      ) {
        return;
      }

      (element as HTMLElement).replaceWith(...element.childNodes);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        quote: false,
      }));
      onClose();

      return;
    }

    const html = richInputCtx.editable.getSelectedHtml({ shouldDropQuotes: true });
    if (!html) return;
    richInputCtx.editable.execCommand('insertHTML',
      `<blockquote class="blockquote">${html}</blockquote>`);
    onClose();
  });

  const handlePreview = useLastCallback(() => {
    window.getSelection()?.removeAllRanges();
    richInputCtx.editable.root.blur();
    richInputCtx.editable.preview.startPreview();
    onClose();
  });

  useRichEditableKeyboardListener(richInputCtx, {
    priority: RichInputKeyboardPriority.Tool,
    onKeydown: (e: KeyboardEvent) => {
      if (!isActive) return false;
      const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
        k: startLinkControl,
        b: handleBoldText,
        u: handleUnderlineText,
        i: handleItalicText,
        m: handleMonospaceText,
        s: handleStrikethroughText,
        p: handleSpoilerText,
        q: handleQuote,
      };

      const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

      if (
        e.altKey
        || !(e.ctrlKey || e.metaKey)
        || !handler
      ) {
        return false;
      }

      e.preventDefault();
      e.stopPropagation();
      handler();
      return true;
    },
  }, isActive);

  const lang = useOldLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  const className = buildClassName(
    'TextFormatter',
    transitionClassNames,
    isLinkControlOpen && 'link-control-shown',
  );

  const linkUrlConfirmClassName = buildClassName(
    'TextFormatter-link-url-confirm',
    Boolean(linkUrl.length) && 'shown',
  );

  const [anchorPosition, setAnchorPosition] = useState<IAnchorPosition>();

  useEffect(() => {
    const selectionRange = richInputCtx.editable.selectionS()?.range;
    if (!selectionRange || !isOpen) return;

    const selectionRect = selectionRange.getBoundingClientRect();
    const rootRect = richInputCtx.editable.root.getBoundingClientRect();

    let x = (selectionRect.left + selectionRect.width / 2) - rootRect.left;

    if (x < TEXT_FORMATTER_SAFE_AREA_PX) {
      x = TEXT_FORMATTER_SAFE_AREA_PX;
    } else if (x > rootRect.width - TEXT_FORMATTER_SAFE_AREA_PX) {
      x = rootRect.width - TEXT_FORMATTER_SAFE_AREA_PX;
    }

    setAnchorPosition({
      x,
      y: selectionRect.top - rootRect.top,
    });
  }, [richInputCtx.editable, richInputCtx.editable.root, richInputCtx.editable.selectionS, isOpen]);

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onKeyDown={handleContainerKeyDown}
      // Prevents focus loss when clicking on the toolbar
      onMouseDown={stopEvent}
    >
      <div className="TextFormatter-buttons">
        <Button
          color="translucent"
          ariaLabel="Spoiler text"
          className={getFormatButtonClassName('spoiler')}
          onClick={handleSpoilerText}
        >
          <Icon name="eye-crossed" />
        </Button>
        <Button
          color="translucent"
          ariaLabel={selectedTextFormats.quote ? 'Break quote' : 'Make quote'}
          className={getFormatButtonClassName('quote')}
          onClick={handleQuote}
        >
          <Icon name={selectedTextFormats.quote === true ? 'remove-quote' : 'quote-text'} />
        </Button>
        <div className="TextFormatter-divider" />
        <Button
          color="translucent"
          ariaLabel="Bold text"
          className={getFormatButtonClassName('bold')}
          onClick={handleBoldText}
        >
          <Icon name="bold" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Italic text"
          className={getFormatButtonClassName('italic')}
          onClick={handleItalicText}
        >
          <Icon name="italic" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Underlined text"
          className={getFormatButtonClassName('underline')}
          onClick={handleUnderlineText}
        >
          <Icon name="underlined" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Strikethrough text"
          className={getFormatButtonClassName('strikethrough')}
          onClick={handleStrikethroughText}
        >
          <Icon name="strikethrough" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Monospace text"
          className={getFormatButtonClassName('monospace')}
          onClick={handleMonospaceText}
        >
          <Icon name="monospace" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')} onClick={startLinkControl}>
          <Icon name="link" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button color="translucent" ariaLabel={"Preview"} style={`
              width: 5rem;
              font-size: 1.3rem;
              text-transform: none;
        `} onClick={handlePreview}>
          {/* TODO: Support translations */}
          Preview
        </Button>
      </div>

      <div className="TextFormatter-link-control">
        <div className="TextFormatter-buttons">
          <Button color="translucent" ariaLabel={lang('Cancel')} onClick={closeLinkControl}>
            <Icon name="arrow-left" />
          </Button>
          <div className="TextFormatter-divider" />

          <div
            className={buildClassName('TextFormatter-link-url-input-wrapper', inputClassName)}
          >
            <input
              ref={linkUrlInputRef}
              className="TextFormatter-link-url-input"
              type="text"
              value={linkUrl}
              placeholder="Enter URL..."
              autoComplete="off"
              inputMode="url"
              dir="auto"
              onChange={handleLinkUrlChange}
              onScroll={updateInputStyles}
            />
          </div>

          <div className={linkUrlConfirmClassName}>
            <div className="TextFormatter-divider" />
            <Button
              color="translucent"
              ariaLabel={lang('Save')}
              className="color-primary"
              onClick={handleLinkUrlConfirm}
            >
              <Icon name="check" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TextFormatter);
