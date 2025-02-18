import focusEditableElement from "../../../util/focusEditableElement";
import { createSignal, Signal } from "../../../util/signals";
import { RichInputKeyboardListener } from "./Keyboard";

const SAFARI_BR = "<br>";

export class RichEditable {
  public root: HTMLDivElement;

  public htmlS: Signal<string>;
  private htmlSet: (html: string) => void;
  public emptyS: Signal<boolean>;
  private emptySet: (empty: boolean) => void;

  private attached: HTMLElement | null;
  private disableEdit: boolean;

  private keyboardHandlers: RichInputKeyboardListener[];

  constructor() {
    this.root = document.createElement("div");
    this.attached = null;

    this.disableEdit = false;
    this.updateRootProps();

    [this.htmlS, this.htmlSet] = createSignal("");
    [this.emptyS, this.emptySet] = createSignal(true);

    this.root.addEventListener("click", () => {
      this.focus();
    });

    this.root.addEventListener("input", () => {
      this.handleContentUpdate();
    });

    this.root.addEventListener("keydown", (e) => {
      for (const handler of this.keyboardHandlers) {
        handler.onKeydown(e);
      }
    })

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
  }

  detachFrom(el: HTMLElement) {
    if (!this.attached) {
      console.warn("Tried to detach when not attached");
      return;
    }

    el.removeChild(this.root);
    this.attached = null;
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

  handleContentUpdate() {
    this.htmlSet(this.root.innerHTML);
    this.emptySet(
      this.root.innerHTML === "" || this.root.innerHTML == SAFARI_BR
    );
  }

  clearInput() {
    this.root.innerHTML = "";
    this.handleContentUpdate();
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

}
