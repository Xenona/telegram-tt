export function insertEnterInsideBlockquote(e: KeyboardEvent) {
  let s = window.getSelection();
  if(s && s.isCollapsed) {
    let r = s.getRangeAt(0)
    let noteAnc: Node | null = r.endContainer
    if (r.endOffset == 0) {
      let isStart = true
      while (noteAnc && (!('tagName' in noteAnc) || noteAnc.tagName !== 'BLOCKQUOTE')) {
        if (noteAnc.previousSibling) {
          isStart = false
          break
        }
        noteAnc = noteAnc.parentNode
      }

      if(isStart && noteAnc) {
        s.removeAllRanges()
        let r = document.createRange()
        r.setStartBefore(noteAnc)
        r.setEndBefore(noteAnc)
        let textNode = document.createTextNode(" ")
        r.insertNode(textNode)
        r.collapse(true)
        s.addRange(r)
        e.preventDefault();
        // document.execCommand("insertText", false, "\n")
      }
    } else if(r.endOffset == r.endContainer.textContent?.length) {
      let isEnd = true
      while (noteAnc && (!('tagName' in noteAnc) || noteAnc.tagName !== 'BLOCKQUOTE')) {
        if (noteAnc.nextSibling) {
          isEnd = false
          break
        }
        noteAnc = noteAnc.parentNode
      }
      if(isEnd && noteAnc) {
        s.removeAllRanges()
        let r = document.createRange()
        r.setStartAfter(noteAnc)
        r.setEndAfter(noteAnc)
        let textNode = document.createTextNode(" ")
        r.insertNode(textNode)
        r.collapse(false)
        s.addRange(r)
        e.preventDefault();
        // document.execCommand("insertText", false, "\n")
      }
    }
  }
}