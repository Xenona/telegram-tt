import useLastCallback from "../../../hooks/useLastCallback";
import {
  RefObject,
  useEffect,
  useRef,
  useSignal,
} from "../../../lib/teact/teact";
import { Signal } from "../../../util/signals";
import { RichInputKeyboardListener } from "./Keyboard";
import { PasteCtx, RichEditable } from "./RichEditable";

export type RichInputCtx = {
  editable: RichEditable;
  getHtml: Signal<string>;
};

export function useRichInput(): RichInputCtx & { ctx: RichInputCtx } {
  const richEditable: RefObject<RichEditable | null> = useRef(null);
  if (!richEditable.current) {
    richEditable.current = new RichEditable();
  }

  const ctx: RichInputCtx = {
    getHtml: richEditable.current.htmlS,
    editable: richEditable.current,
  };

  return { ...ctx, ctx };
}

export function useRichInputKeyboardListener(
  richInputCtx: RichInputCtx,
  handler: RichInputKeyboardListener
) {
  const keydownCallback = useLastCallback(handler.onKeydown);

  useEffect(() => {
    return richInputCtx.editable.addKeyboardHandler({
      ...handler,
      onKeydown: keydownCallback,
    });
  }, [richInputCtx.editable, keydownCallback]);
}

export function useRichInputPasteHandler(
  richInputCtx: RichInputCtx,
  handler: (p: PasteCtx) => void,
  enable = true
) {
  const keydownCallback = useLastCallback(handler);

  useEffect(() => {
    if(!enable) return () => {};

    return richInputCtx.editable.addPasteHandler(keydownCallback);
  }, [richInputCtx.editable, keydownCallback]);
}
