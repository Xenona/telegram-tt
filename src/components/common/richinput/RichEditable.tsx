import focusEditableElement from "../../../util/focusEditableElement";

export class RichEditable {
  public root: HTMLDivElement;
  private attached: HTMLElement | null;
  private disableEdit: boolean;

  constructor() {
    this.root = document.createElement("div");
    this.attached = null;

    this.disableEdit = false;
    this.updateRootProps();

    this.root.addEventListener("click", () => {
      this.focus();
    });
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

  subscribeHtml(cb: (html: string) => void) {
    this.root.addEventListener("input", () => {
      cb(this.root.innerHTML);
    });
  }
}
