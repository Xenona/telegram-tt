import useLastCallback from "../../../hooks/useLastCallback";
import {
  RefObject,
  useEffect,
  useRef,
  useSignal,
} from "../../../lib/teact/teact";
import { Signal } from "../../../util/signals";
import { RichInputKeyboardListener } from "./Keyboard";
import { RichEditable } from "./RichEditable";

export type RichInputCtx = {
  editable: RichEditable;
  getHtml: Signal<string>;
  setHtml: (s: string) => void;
};

export function useRichInput(): RichInputCtx & { ctx: RichInputCtx } {
  const richEditable: RefObject<RichEditable | null> = useRef(null);
  if (!richEditable.current) {
    richEditable.current = new RichEditable();
  }

  const ctx: RichInputCtx = {
    getHtml: richEditable.current.htmlS,
    setHtml: (v: string) => {
      console.warn("AAAA I am am a set");
    },
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
    let ehandler = {
      ...handler,
      onKeydown: keydownCallback,
    };
    richInputCtx.editable.addKeyboardHandler(ehandler);

    return () => {
      richInputCtx.editable.removeKeyboardHandler(ehandler);
    };
  }, [richInputCtx.editable, keydownCallback]);
}
