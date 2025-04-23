import { ApiFormattedText } from "../../../api/types";
import { requestMutation } from "../../../lib/fasterdom/fasterdom";
import React from "../../../lib/teact/teact";
import TeactDOM from "../../../lib/teact/teact-dom";
import { createSignal, Signal } from "../../../util/signals";
import { renderTextWithEntities } from "../helpers/renderTextWithEntities";
import type { RichEditable } from "./RichEditable";

export class Previewer {
  public root: HTMLElement;
  private editable: RichEditable;
  private hiddenOnPreview: HTMLElement[];

  public isPreviewing: Signal<boolean>;
  private setIsPreviewing: (isPreviewing: boolean) => void;

  constructor(edtiable: RichEditable) {
    this.editable = edtiable;
    this.root = document.createElement("div");
    this.root.classList.add("inputPreview");
    this.root.classList.add("previewHidden");

    this.hiddenOnPreview = [
      this.editable.root,
      this.editable.emojiRenderer.sharedCanvas,
      this.editable.emojiRenderer.sharedCanvasHq,
      this.editable.emojiRenderer.absoluteContainer,
    ];
    [this.isPreviewing, this.setIsPreviewing] = createSignal(false);

    this.editable.root.addEventListener("focus", () => {
      console.log("RRR FOCUS END PREVIEW")
      this.endPreview();
    });
  }

  addHiddenOnPreview(...el: HTMLElement[]) {
    this.hiddenOnPreview.push(...el);
  }

  refreshPreview() {
    if (!this.isPreviewing()) return;

    const text = this.editable.getFormattedText();
    TeactDOM.render(<>{renderTextWithEntities(text)}</>, this.root);
  }

  startPreview() {
    if (this.isPreviewing()) return;
    console.log("RRR Started preview");
    this.setIsPreviewing(true);
    this.refreshPreview();

    requestMutation(() => {
      for (const el of this.hiddenOnPreview) {
        el.classList.add("previewHidden");
      }
      this.root.classList.remove("previewHidden");
    });
  }

  endPreview() {
    if (!this.isPreviewing()) return;

    this.setIsPreviewing(false);
    requestMutation(() => {
      for (const el of this.hiddenOnPreview) {
        el.classList.remove("previewHidden");
      }
      this.root.classList.remove("previewHidden");
      TeactDOM.render(undefined, this.root);
    });
  }
}
