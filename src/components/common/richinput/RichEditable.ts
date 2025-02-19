import { ApiFormattedText } from "../../../api/types";
import { betterExecCommand } from "../../../util/execCommand";
import focusEditableElement from "../../../util/focusEditableElement";
import parseHtmlAsFormattedText from "../../../util/parseHtmlAsFormattedText";
import { createSignal, Signal } from "../../../util/signals";
import { getTextWithEntitiesAsHtml } from "../helpers/renderTextWithEntities";
import { RichInputKeyboardListener } from "./Keyboard";

const SAFARI_BR = "<br>";
const WHITESPACE_RE = /\s/;
export const IMG_ALT_MATCHABLE_MARKER = "IMG_ALT__";

export class RichEditable {
  public root: HTMLDivElement;

  public htmlS: Signal<string>;
  private htmlSet: (html: string) => void;
  public emptyS: Signal<boolean>;
  private emptySet: (empty: boolean) => void;
  public matchableS: Signal<string | null>;
  private matchableSet: (matchable: string | null) => void;

  private attached: HTMLElement | null;
  private disableEdit: boolean;

  private keyboardHandlers: RichInputKeyboardListener[];
  private selectionListener: (() => void);

  constructor() {
    this.root = document.createElement("div");
    this.attached = null;

    this.disableEdit = false;
    this.updateRootProps();

    [this.htmlS, this.htmlSet] = createSignal("");
    [this.emptyS, this.emptySet] = createSignal(true);
    [this.matchableS, this.matchableSet] = createSignal<string | null>(null);

    this.root.addEventListener("click", () => {
      this.focus();
    });

    this.root.addEventListener("input", () => {
      this.handleContentUpdate();
    });

    this.selectionListener = () => this.handleSelectionUpdate();

    this.root.addEventListener("keydown", (e) => {
      for (const handler of this.keyboardHandlers) {
        handler.onKeydown(e);
      }
      this.handleSelectionUpdate();
    });

    this.keyboardHandlers = [];
  }

  updateRootProps() {
    if (this.disableEdit) {
      this.root.contentEditable = "false";
    } else {
      this.root.contentEditable = "true";
    }
    this.root.role = "textbox";
    this.root.dir = "auto";
  }

  attachTo(el: HTMLElement) {
    if (this.attached) {
      throw new Error("Tried to attach when already attached");
    }

    this.attached = el;
    el.appendChild(this.root);

    document.addEventListener("selectionchange", this.selectionListener);
  }

  detachFrom(el: HTMLElement) {
    if (!this.attached) {
      console.warn("Tried to detach when not attached");
      return;
    }

    el.removeChild(this.root);
    this.attached = null;

    document.removeEventListener("selectionchange", this.selectionListener);
  }

  isAttached(el?: HTMLElement) {
    if (el) return this.attached === el;
    return this.attached !== null;
  }

  applyRootProperties(props: {
    className?: string;
    disableEdit?: boolean;
    placeholder?: string;
    tabIndex?: number;
  }) {
    if (props.className) {
      this.root.className = props.className;
    }
    if (props.placeholder) {
      this.root.setAttribute("aria-label", props.placeholder);
    }
    if (props.tabIndex !== undefined) {
      this.root.tabIndex = props.tabIndex;
    }
    if (props.disableEdit !== undefined) {
      this.disableEdit = props.disableEdit;
    }
    this.updateRootProps();
  }

  focus(force?: boolean, forcePlaceCaretAtEnd?: boolean) {
    focusEditableElement(this.root, force, forcePlaceCaretAtEnd);
  }

  blur() {
    this.root.blur();
  }

  calculateMatchable(s: Selection, r: Range): string | null {
    if (!s.isCollapsed) return null;

    // TODO: Check not inside code block

    let curNode = r.endContainer;
    if (r.endContainer.nodeType != document.TEXT_NODE && r.endOffset > 0) {
      let childNode = r.endContainer.childNodes[r.endOffset - 1]
      if(childNode)
        curNode = childNode;
    }
    
    if (curNode.nodeType != document.TEXT_NODE) {
      if(curNode.nodeType == document.ELEMENT_NODE) {
        const curEl = curNode as HTMLElement;
        if(curEl.tagName == "IMG") {
          return `IMG_ALT__${curEl.getAttribute("alt")}`;
        }
      }
      return null;
    }

    const str = curNode.textContent;
    if (!str) return null;

    let startPos = r.endOffset - 1;
    while (startPos > 0 && !WHITESPACE_RE.test(str[startPos])) {
      startPos -= 1;
    }

    let ra = str.slice(startPos, r.endOffset);
    // console.log("RAA", ra, str, startPos, r.endOffset);
    return ra;
  }

  handleSelectionUpdate() {
    const s = window.getSelection();
    if (s && s.rangeCount > 0) {
      const r = s?.getRangeAt(0);
      this.matchableSet(this.calculateMatchable(s, r));
    }
  }

  handleContentUpdate() {
    this.htmlSet(this.root.innerHTML);
    this.emptySet(
      this.root.innerHTML === "" || this.root.innerHTML == SAFARI_BR
    );
    this.handleSelectionUpdate();
  }

  clearInput() {
    this.root.innerHTML = "";
    this.handleContentUpdate();
  }

  setFormattedText(text: ApiFormattedText | undefined): string {
    if (!text) {
      this.clearInput();
      return "";
    }

    const html = getTextWithEntitiesAsHtml(text);
    this.root.innerHTML = html;
    this.handleContentUpdate();
    const s = window.getSelection();
    if (s && this.root.lastChild) {
      let r = document.createRange();
      r.setEndAfter(this.root.lastChild);
      r.setStartAfter(this.root.lastChild);
      s.removeAllRanges();
      s.addRange(r);
    }
    return html;
  }

  getFormattedText(formatMarkdown: boolean = true): ApiFormattedText {
    return parseHtmlAsFormattedText(this.htmlS(), false, true);
  }

  addKeyboardHandler(handler: RichInputKeyboardListener) {
    this.keyboardHandlers.push(handler);
    this.keyboardHandlers = this.keyboardHandlers.sort(
      (a, b) => b.priority - a.priority
    );
  }

  removeKeyboardHandler(handler: RichInputKeyboardListener) {
    this.keyboardHandlers = this.keyboardHandlers.filter((h) => h !== handler);
  }

  execCommand(cmd: string, value?: string) {
    betterExecCommand(this.root, cmd, value);
  }

  insertMatchableHtml(html: string, matchLimit: (c: string) => boolean) {
    const s = window.getSelection();
    if (!s || !s.rangeCount) return;

    const r = s.getRangeAt(0);

    let curNode = r.startContainer;
    if (r.startContainer.nodeType != document.TEXT_NODE) {
      curNode = r.startContainer.childNodes[r.startOffset];
    }

    if (r.startContainer.nodeType != document.TEXT_NODE) return null;

    const str = curNode.textContent;
    if (!str) return;

    const endPos = r.endOffset;
    let startPos = r.endOffset;
    while (startPos > 0 && !matchLimit(str[startPos])) {
      startPos--;
    }
    
    r.setStart(curNode, startPos)
    r.setEnd(curNode, endPos)
    s.removeAllRanges();
    s.addRange(r)
    this.execCommand("insertHTML", html);
  }
}
