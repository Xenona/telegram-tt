export const isBlockquote = (noteAnc: Node) =>
  "tagName" in noteAnc && noteAnc.tagName == "BLOCKQUOTE";

export class BlockQuoteEnterHandler {
  private wasEnter = false;

  attachHandler(target: HTMLElement) {
    target.addEventListener("beforeinput", this.evHandler.bind(this));
  }

  evHandler(e: InputEvent) {
    if (e.inputType != "insertLineBreak" && e.inputType != "insertParagraph") {
      this.wasEnter = false;
      return;
    }

    this.insertEnterInsideBlockquote(e);

    if (e.inputType == "insertParagraph") {
      const s = window.getSelection();

      if (s) {
        const r = s.getRangeAt(0);
        let noteAnc: Node | null = r.endContainer;
        while (noteAnc && !isBlockquote(noteAnc)) {
          noteAnc = noteAnc.parentNode;
        }

        if (noteAnc && isBlockquote(noteAnc)) {
          e.preventDefault();
          document.execCommand("insertLineBreak", false);
        }
      }
    }

    this.wasEnter = true;
  }

  insertEnterInsideBlockquote(e: InputEvent): boolean {
    const s = window.getSelection();

    if (s && s.isCollapsed) {
      const r = s.getRangeAt(0);
      let noteAnc: Node | null = r.endContainer;

      let remEnd = r.endContainer.textContent?.substring(r.endOffset);
      if (this.wasEnter && (remEnd == "\n" || remEnd == "")) {
        let isEnd = true;
        while (noteAnc && !isBlockquote(noteAnc)) {
          if (noteAnc.nextSibling) {
            if (noteAnc.nextSibling.textContent == "") {
              noteAnc = noteAnc.nextSibling;
              continue;
            }
            isEnd = false;
            break;
          }

          noteAnc = noteAnc.parentNode;
        }

        if (isEnd && noteAnc) {
          if (r.endContainer.textContent)
            r.endContainer.textContent = r.endContainer.textContent?.substring(
              0,
              r.endOffset
            );

          s.removeAllRanges();
          const nr = document.createRange();
          nr.setStartAfter(noteAnc);
          nr.setEndAfter(noteAnc);
          const textNode = document.createTextNode(" ");
          nr.insertNode(textNode);
          nr.collapse(false);
          s.addRange(nr);
          e.preventDefault();

          return true;
        }
      } else if (r.endOffset === 0) {
        let isStart = true;
        while (noteAnc && !isBlockquote(noteAnc)) {
          if (noteAnc.previousSibling) {
            isStart = false;
            break;
          }
          noteAnc = noteAnc.parentNode;
        }

        if (isStart && noteAnc) {
          s.removeAllRanges();
          const nr = document.createRange();
          nr.setStartBefore(noteAnc);
          nr.setEndBefore(noteAnc);
          const textNode = document.createTextNode(" ");
          nr.insertNode(textNode);
          nr.collapse(true);
          s.addRange(nr);
          e.preventDefault();
          return true;
        }
      }
    }
    return false;
  }
}
