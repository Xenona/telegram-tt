import type { FC, RefObject } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';
import { ApiMessageEntityTypes } from '../../../api/types';

import { EDITABLE_INPUT_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { ensureProtocol } from '../../../util/ensureProtocol';
import getKeyFromEvent from '../../../util/getKeyFromEvent';
import stopEvent from '../../../util/stopEvent';
import { INPUT_CUSTOM_EMOJI_SELECTOR } from './helpers/customEmoji';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import './TextFormatter.scss';
import { betterExecCommand } from '../../../util/execCommand';
import { selectAfterNode } from '../../../util/selection';
import { RichInputCtx } from '../../common/richinput/useRichInput';

export type OwnProps = {
  richInputCtx: RichInputCtx
  isOpen: boolean;
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
const fragmentEl = document.createElement('div');

const TEXT_FORMATTER_SAFE_AREA_PX = 140;

const TextFormatter: FC<OwnProps> = ({
  richInputCtx,
  isOpen: shouldOpen,
  onClose,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const isOpen = shouldOpen || isEditingLink;
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});
  console.log("FFF", isLinkControlOpen, isOpen, shouldRender)
  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    console.log("XXX", linkUrlInputRef)
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
    let { parentElement } = sel.range.commonAncestorContainer;
    while (parentElement && parentElement.id !== EDITABLE_INPUT_ID) {
      const textFormat = TEXT_FORMAT_BY_TAG_NAME[parentElement.tagName];
      if (textFormat) {
        selectedFormats[textFormat] = true;
      }

      parentElement = parentElement.parentElement;
    }

    setSelectedTextFormats(selectedFormats);
  }, [isOpen, richInputCtx.editable.selectionS, openLinkControl]);

  const getSelectedHTML = useLastCallback((shouldDropCustomEmoji?: boolean) => {
    const sel = richInputCtx.editable.selectionS();
    if (!sel) {
      return undefined;
    }
    fragmentEl.replaceChildren(sel.range.cloneContents());
    if (shouldDropCustomEmoji) {
      fragmentEl.querySelectorAll(INPUT_CUSTOM_EMOJI_SELECTOR).forEach((el) => {
        el.replaceWith(el.getAttribute('alt')!);
      });
    }
    return fragmentEl.innerHTML;
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

    const text = getSelectedHTML();
    console.log(window.getSelection()?.getRangeAt(0).cloneRange());
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
    if(window.getSelection()?.isCollapsed) return;

    if (selectedTextFormats.monospace) {
      richInputCtx.editable.execCommand('removeFormat');
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        monospace: false,
      }));
      return;
    }

    const previousCode = [...(richInputCtx.editable.root.querySelectorAll("code") || [])];
    
    let text = richInputCtx.editable.selectionS()?.range?.toString() || '';
    if(text.length == 0) text = ''
    richInputCtx.editable.execCommand(
      "insertHTML",
      `<code class="text-entity-code" dir="auto">${text}</code>`
    );
    
    const currentCode = richInputCtx.editable.root?.querySelectorAll("code") || [];
    for (let el of currentCode) {
      if (previousCode.includes(el)) continue;
      selectAfterNode(el)
    }
    onClose();
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    const formattedLinkUrl = (ensureProtocol(linkUrl) || '').split('%').map(encodeURI).join('%');

    if (isEditingLink) {
      const element = getSelectedElement();
      if (!element || element.tagName !== 'A') {
        return;
      }

      (element as HTMLAnchorElement).href = formattedLinkUrl;

      onClose();

      return;
    }

    const text = getSelectedHTML(true);
    richInputCtx.editable.execCommand(
      'insertHTML',
      `<a href=${formattedLinkUrl} class="text-entity-link" dir="auto">${text}</a>`,
    );
    onClose();
  });

  const handleQuote = useLastCallback(() => {
    if (selectedTextFormats.quote) {
      const element = getSelectedElement();
      if (
        !richInputCtx.editable.selectionS()
        || !element
        || element.tagName !== 'BLOCKQUOTE'
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        blockquote: false,
      }));

      return;
    }

    let fragmentEl = document.createElement('div');
    fragmentEl.replaceChildren(window.getSelection()!.getRangeAt(0)!.cloneContents());
    let clearBlockQuote: HTMLElement | null;
    while(clearBlockQuote = fragmentEl.querySelector('blockquote')) {
      clearBlockQuote.replaceWith(...clearBlockQuote.childNodes);
    }
    richInputCtx.editable.execCommand('insertHTML', `<blockquote class="blockquote">${fragmentEl.innerHTML}</blockquote>`);
    onClose();
  });

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
      k: openLinkControl,
      b: handleBoldText,
      u: handleUnderlineText,
      i: handleItalicText,
      m: handleMonospaceText,
      s: handleStrikethroughText,
      p: handleSpoilerText,
      q: handleQuote
    };

    const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

    if (
      e.altKey
      || !(e.ctrlKey || e.metaKey)
      || !handler
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handler();
  });

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const lang = useOldLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  if (!shouldRender) {
    return undefined;
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
    const selectionRange = window.getSelection()!.getRangeAt(0);
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
  }, [richInputCtx.editable.root, richInputCtx.editable.selectionS]);

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

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
          <Icon name="eye-closed" />
        </Button>
        <Button
          color="translucent"
          ariaLabel={selectedTextFormats.quote ? "Break quote" :  "Make quote" }
          className={getFormatButtonClassName('quote')}
          onClick={handleQuote}
        >
          <Icon name={selectedTextFormats.quote === true ? "remove-quote" :  "quote-text" } />
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
        <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')} onClick={openLinkControl}>
          <Icon name="link" />
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
