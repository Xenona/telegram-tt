import React from '../../../lib/teact/teact';
import TeactDOM from '../../../lib/teact/teact-dom';

import type { Signal } from '../../../util/signals';
import type { RichEditable } from './RichEditable';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { createSignal } from '../../../util/signals';
import { renderTextWithEntities } from '../helpers/renderTextWithEntities';

import styles from './RichEditable.module.scss';

export class Previewer {
  public root: HTMLElement;

  private editable: RichEditable;

  private hiddenOnPreview: HTMLElement[];

  public isPreviewing: Signal<boolean>;

  private setIsPreviewing: (isPreviewing: boolean) => void;

  constructor(edtiable: RichEditable) {
    this.editable = edtiable;
    this.root = document.createElement('div');
    this.root.classList.add(styles.inputPreview);
    this.root.classList.add(styles.previewHidden);
    // While not really a form control, it needs same styles
    // this.root.classList.add('form-control');

    this.hiddenOnPreview = [
      this.editable.root,
      this.editable.emojiRenderer.sharedCanvas,
      this.editable.emojiRenderer.sharedCanvasHq,
      this.editable.emojiRenderer.absoluteContainer,
    ];
    [this.isPreviewing, this.setIsPreviewing] = createSignal(false);

    this.editable.root.addEventListener('focus', () => {
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
    this.setIsPreviewing(true);
    this.refreshPreview();

    requestMutation(() => {
      for (const el of this.hiddenOnPreview) {
        el.classList.add(styles.previewHidden);
      }
      this.root.classList.remove(styles.previewHidden);
    });
  }

  endPreview() {
    if (!this.isPreviewing()) return;

    this.setIsPreviewing(false);
    requestMutation(() => {
      for (const el of this.hiddenOnPreview) {
        el.classList.remove(styles.previewHidden);
      }
      this.root.classList.remove(styles.previewHidden);
      TeactDOM.render(undefined, this.root);
    });
  }
}
