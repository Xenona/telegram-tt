import { RefObject, useRef, useSignal } from "../../../lib/teact/teact";
import { subscribe } from "../../../util/notifications";
import { Signal } from "../../../util/signals";
import { RichEditable } from "./RichEditable";

export type RichInputCtx = {
  editable: RichEditable;
  getHtml: Signal<string>;
  setHtml: (s: string) => void;
};

export function useRichInput(): RichInputCtx & { ctx: RichInputCtx } {
  const [getHtml, setHtml] = useSignal("");
  const richEditable: RefObject<RichEditable | null> = useRef(null);
  if (!richEditable.current) {
    richEditable.current = new RichEditable();
    richEditable.current.subscribeHtml((html: string) => {
      setHtml(html);
    })
  }


  const ctx: RichInputCtx = {
    getHtml,
    setHtml: (v: string) => {
      console.log("AAAA I am am a set");
    },
    editable: richEditable.current,
  };

  return { ...ctx, ctx };
}
