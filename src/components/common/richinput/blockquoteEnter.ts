export function insertEnterInsideBlockquote(e: KeyboardEvent): boolean {
  const s = window.getSelection();
  if (s && s.isCollapsed) {
    const r = s.getRangeAt(0);
    let noteAnc: Node | null = r.endContainer;
    if (r.endOffset === 0) {
      let isStart = true;
      while (noteAnc && (!('tagName' in noteAnc) || noteAnc.tagName !== 'BLOCKQUOTE')) {
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
        const textNode = document.createTextNode(' ');
        nr.insertNode(textNode);
        nr.collapse(true);
        s.addRange(nr);
        e.preventDefault();
        // document.execCommand("insertText", false, "\n")
        return true;
      }
    } else if (r.endOffset === r.endContainer.textContent?.length) {
      let isEnd = true;
      while (noteAnc && (!('tagName' in noteAnc) || noteAnc.tagName !== 'BLOCKQUOTE')) {
        if (noteAnc.nextSibling) {
          isEnd = false;
          break;
        }
        noteAnc = noteAnc.parentNode;
      }
      if (isEnd && noteAnc) {
        s.removeAllRanges();
        const nr = document.createRange();
        nr.setStartAfter(noteAnc);
        nr.setEndAfter(noteAnc);
        const textNode = document.createTextNode(' ');
        nr.insertNode(textNode);
        nr.collapse(false);
        s.addRange(nr);
        e.preventDefault();
        // document.execCommand("insertText", false, "\n")
        return true;
      }
    }
  }
  return false;
}
