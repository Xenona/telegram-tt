// Improvements, utils and workarounds for execCommand api

import { forceMutation } from "../lib/fasterdom/stricterdom";

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
  command: string,
  value?: string
) {
  const inpArr = [];
  if (input) inpArr.push(input);
    
  forceMutation(() => {
    input?.classList.add("for-exec-command-fix");
    document.execCommand('styleWithCss', false, 'false');
    document.execCommand(command, false, value);
    input?.classList.remove("for-exec-command-fix");
  }, inpArr);
}
