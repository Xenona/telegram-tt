// Improvements, utils and workarounds for execCommand api

import { requestMutation } from "../lib/fasterdom/fasterdom";

const EX_FIX = "for-exec-command-fix";

const style = document.createElement("style");
document.head.appendChild(style); // must append before you can access sheet property

style.innerHTML = `
.${EX_FIX} * {
  display: inline  !important; // Required for insertHTML to work properly
}

.${EX_FIX} b {
  font-weight: bold !important; // Required for "bold" command to unbold
}
`;

export function betterExecCommand(
  input: HTMLElement | null,
  range: Range | null,
  command: string,
  value?: string
) {
  const inpArr = [];
  if (input) inpArr.push(input);

  requestMutation(() => {
    if (range) {
      window.getSelection()?.removeAllRanges();
      console.log(range)
      window.getSelection()?.addRange(range);
    }
    input?.classList.add("for-exec-command-fix");
    document.execCommand('styleWithCss', false, 'false');
    document.execCommand(command, false, value);
    input?.classList.remove("for-exec-command-fix");
  });
}
