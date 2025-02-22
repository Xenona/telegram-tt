import type { ApiFormattedText } from '../../../api/types';
import type { Signal } from '../../../util/signals';
import type { RichInputKeyboardListener } from './Keyboard';

import { betterExecCommand } from '../../../util/execCommand';
import focusEditableElement from '../../../util/focusEditableElement';
import parseHtmlAsFormattedText from '../../../util/parseHtmlAsFormattedText';
import { createSignal } from '../../../util/signals';
import { preparePastedHtml } from '../../middle/composer/helpers/cleanHtml';
import { getTextWithEntitiesAsHtml } from '../helpers/renderTextWithEntities';
import { insertEnterInsideBlockquote } from './blockquoteEnter';

import { EditableEmojiRender } from './EditableEmojiRender';
import { RichInputKeyboardPriority } from './Keyboard';

const SAFARI_BR = '<br>';
const WHITESPACE_RE = /\s/;
export const IMG_ALT_MATCHABLE_MARKER = 'IMG_ALT__';

export type SelectionState = {
  collapsed: boolean;
  range: Range;
};

export type PasteCtx = {
  editable: RichEditable;
  text: ApiFormattedText;
  html: string;
  items: DataTransferItemList;
};

export class RichEditable {
  public root: HTMLDivElement;

  public htmlS: Signal<string>;

  private htmlSet: (html: string) => void;

  public emptyS: Signal<boolean>;

  private emptySet: (empty: boolean) => void;

  public matchableS: Signal<string | undefined>;

  private matchableSet: (matchable: string | undefined) => void;

  public selectionS: Signal<SelectionState | undefined>;

  private selectionSet: (selection: SelectionState | undefined) => void;

  private attached: HTMLElement | undefined;

  private disableEdit: boolean;

  private keyboardHandlers: RichInputKeyboardListener[];

  private selectionListener: () => void;

  private pasteHandlers: ((p: PasteCtx) => void)[];

  private pasteListener: (e: ClipboardEvent) => void;

  public emojiRenderer: EditableEmojiRender;

  constructor() {
    this.root = document.createElement('div');
    this.attached = undefined;

    this.disableEdit = false;
    this.updateRootProps();

    [this.htmlS, this.htmlSet] = createSignal('');
    [this.emptyS, this.emptySet] = createSignal(true);
    [this.matchableS, this.matchableSet] = createSignal<string | undefined>(undefined);
    [this.selectionS, this.selectionSet] = createSignal<SelectionState | undefined>(
      undefined,
    );

    this.keyboardHandlers = [];
    this.pasteHandlers = [];

    this.selectionListener = () => this.handleSelectionUpdate();
    this.pasteListener = (e) => this.handlePaste(e);

    this.root.addEventListener('click', () => {
      this.focus();
    });

    this.root.addEventListener('input', () => {
      this.handleContentUpdate();
    });

    this.root.addEventListener('keydown', (e) => {
      for (const handler of this.keyboardHandlers) {
        if (handler.onKeydown(e)) break;
      }
      this.handleSelectionUpdate();
    });

    this.emojiRenderer = new EditableEmojiRender(this);

    this.addKeyboardHandler({
      priority: RichInputKeyboardPriority.Default,
      onKeydown: (e) => {
        if (e.key === 'Enter') {
          insertEnterInsideBlockquote(e);
          return true;
        }
        return false;
      },
    });
  }

  private updateRootProps() {
    if (this.disableEdit) {
      this.root.contentEditable = 'false';
    } else {
      this.root.contentEditable = 'true';
    }
    this.root.role = 'textbox';
    this.root.dir = 'auto';
  }

  public attachTo(el: HTMLElement) {
    if (this.attached) {
      throw new Error('Tried to attach when already attached');
    }

    this.attached = el;
    el.appendChild(this.root);

    document.addEventListener('selectionchange', this.selectionListener);
    document.addEventListener('paste', this.pasteListener);

    this.emojiRenderer.attachTo(el);

    this.handleContentUpdate();
  }

  public detachFrom(el: HTMLElement) {
    if (!this.attached) {
      // eslint-disable-next-line no-console
      console.warn('Tried to detach when not attached');
      return;
    }

    this.emojiRenderer.detachFrom(el);

    document.removeEventListener('selectionchange', this.selectionListener);
    document.removeEventListener('paste', this.pasteListener);

    el.removeChild(this.root);
    this.attached = undefined;
  }

  public isAttached(el?: HTMLElement) {
    if (el) return this.attached === el;
    return this.attached !== undefined;
  }

  public applyRootProperties(props: {
    className?: string;
    disableEdit?: boolean;
    placeholder?: string;
    tabIndex?: number;
  }) {
    if (props.className) {
      this.root.className = props.className;
    }
    if (props.placeholder) {
      this.root.setAttribute('aria-label', props.placeholder);
    }
    if (props.tabIndex !== undefined) {
      this.root.tabIndex = props.tabIndex;
    }
    if (props.disableEdit !== undefined) {
      this.disableEdit = props.disableEdit;
    }
    this.updateRootProps();
  }

  public focus(force?: boolean, forcePlaceCaretAtEnd?: boolean) {
    focusEditableElement(this.root, force, forcePlaceCaretAtEnd);
  }

  public blur() {
    this.root.blur();
  }

  private isRangeInside(r: Range) {
    let parentNode: HTMLElement | undefined = r.commonAncestorContainer as HTMLElement;
    let iterations = 1;
    while (parentNode && parentNode !== this.root && iterations < 10) {
      parentNode = parentNode.parentElement ?? undefined;
      iterations++;
    }

    if (parentNode !== this.root) {
      return false;
    }
    return true;
  }

  private ensureSelectionInside() {
    const s = window.getSelection();
    if (!s) return;

    if (s.rangeCount > 0) {
      const r = s.getRangeAt(0);
      if (this.isRangeInside(r)) return;
    }

    const nr = document.createRange();
    nr.selectNodeContents(this.root);
    nr.collapse(false);
    s.removeAllRanges();
    s.addRange(nr);
  }

  // eslint-disable-next-line class-methods-use-this
  private calculateMatchable(s: Selection, r: Range): string | undefined {
    if (!s.isCollapsed) return undefined;

    // TODO: Check not inside code block

    let curNode = r.endContainer;
    let endPos = r.endOffset;
    let startPos = r.endOffset;
    if (
      curNode.nodeType !== document.TEXT_NODE
      && curNode.childNodes[endPos - 1]?.nodeType === document.TEXT_NODE
    ) {
      curNode = curNode.childNodes[endPos - 1];
      endPos = curNode.textContent?.length || 0;
      startPos = endPos;
    }

    if (curNode.nodeType !== document.TEXT_NODE) {
      if (curNode.nodeType === document.ELEMENT_NODE) {
        const curEl = curNode as HTMLElement;
        if (curEl.tagName === 'IMG') {
          return `IMG_ALT__${curEl.getAttribute('alt')}`;
        }
      }
      return undefined;
    } else {
      startPos--;
      endPos--;
    }

    const str = curNode.textContent;
    if (!str) return undefined;

    while (startPos > 0 && !WHITESPACE_RE.test(str[startPos])) {
      startPos -= 1;
    }

    const ra = str.slice(startPos, endPos);
    return ra;
  }

  private handleSelectionUpdate() {
    const s = window.getSelection();
    const notSelected = !s || s.rangeCount === 0;
    const r = notSelected ? undefined : s?.getRangeAt(0);

    if (notSelected || !r || !this.isRangeInside(r)) {
      this.matchableSet(undefined);
      this.selectionSet(undefined);
      return;
    }

    this.matchableSet(this.calculateMatchable(s, r));
    this.selectionSet({
      collapsed: s.isCollapsed,
      range: r,
    });
  }

  private handleContentUpdate() {
    if (!this.attached) return;
    this.htmlSet(this.root.innerHTML);
    this.emptySet(
      this.root.innerHTML === '' || this.root.innerHTML === SAFARI_BR,
    );

    this.handleSelectionUpdate();
    this.emojiRenderer.synchronizeElements();
  }

  public clearInput() {
    // TODO: Clear styling
    this.root.innerHTML = '';
    this.handleContentUpdate();
  }

  public setFormattedText(text: ApiFormattedText | undefined): string {
    if (!text) {
      this.clearInput();
      return '';
    }

    const html = getTextWithEntitiesAsHtml(text);
    this.root.innerHTML = html;
    this.handleContentUpdate();

    const s = window.getSelection();
    if (s && this.root.lastChild) {
      const r = document.createRange();
      r.setEndAfter(this.root.lastChild);
      r.setStartAfter(this.root.lastChild);
      s.removeAllRanges();
      s.addRange(r);
    }
    return html;
  }

  public getFormattedText(formatMarkdown: boolean = true): ApiFormattedText {
    return parseHtmlAsFormattedText(this.htmlS(), false, !formatMarkdown);
  }

  public addKeyboardHandler(handler: RichInputKeyboardListener) {
    this.keyboardHandlers.push(handler);
    this.keyboardHandlers = this.keyboardHandlers.sort(
      (a, b) => b.priority - a.priority,
    );
    return () => this.keyboardHandlers.filter((h) => h !== handler);
  }

  public addPasteHandler(handler: (p: PasteCtx) => void) {
    this.pasteHandlers.push(handler);
    return () => this.pasteHandlers.filter((h) => h !== handler);
  }

  public execCommand(cmd: string, value?: string) {
    this.ensureSelectionInside();
    betterExecCommand(this.root, this.selectionS()?.range ?? undefined, cmd, value);
    this.handleContentUpdate();
  }

  public insertMatchableHtml(html: string, matchLimit: (c: string) => boolean) {
    const s = window.getSelection();
    if (!s || !s.rangeCount) return;

    const r = s.getRangeAt(0);

    let curNode = r.endContainer;
    let endPos = r.endOffset;
    let startPos = r.endOffset;

    if (
      curNode.nodeType !== document.TEXT_NODE
      && curNode.childNodes[endPos - 1]?.nodeType === document.TEXT_NODE
    ) {
      curNode = curNode.childNodes[endPos - 1];
      endPos = curNode.textContent?.length || 0;
      startPos = endPos;
    }

    if (r.startContainer.nodeType === document.TEXT_NODE) {
      const str = curNode.textContent;
      if (!str) return;

      while (startPos > 0 && !matchLimit(str[startPos])) {
        startPos--;
      }
    } else if (r.startContainer.nodeType === document.ELEMENT_NODE) {
      if (startPos > 0) startPos--;
    }

    r.setStart(curNode, startPos);
    r.setEnd(curNode, endPos);
    s.removeAllRanges();
    s.addRange(r);
    this.execCommand('insertHTML', html);
  }

  public removeLastSymbol() {
    this.execCommand('delete');
  }

  public insertFormattedText(text: ApiFormattedText) {
    const html = getTextWithEntitiesAsHtml(text);
    this.execCommand('insertHTML', html);
  }

  private handlePaste(e: ClipboardEvent) {
    if (!e.clipboardData) {
      return;
    }

    let curNode: HTMLElement | undefined = e.target as HTMLElement;
    while (curNode && curNode !== this.root) {
      curNode = curNode.parentElement ?? undefined;
    }
    if (curNode !== this.root) {
      return;
    }

    e.preventDefault();

    if (document.activeElement !== this.root) {
      return;
    }

    const pastedText = e.clipboardData.getData('text');
    const html = e.clipboardData.getData('text/html');

    const pasteCtx: PasteCtx = {
      editable: this,
      text: { text: pastedText },
      html,
      items: e.clipboardData.items,
    };
    if (html) {
      pasteCtx.text = parseHtmlAsFormattedText(preparePastedHtml(html), undefined, true);
      // TODO: This is needed to handle paste from vscode, but damn is this stupid
      if (!pasteCtx.text.entities?.length) {
        pasteCtx.text = { text: pastedText };
      }
    }

    for (const pasteHandler of this.pasteHandlers) {
      pasteHandler(pasteCtx);
    }

    this.insertFormattedText(pasteCtx.text);
  }
}
