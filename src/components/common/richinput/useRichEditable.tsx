import type { RefObject } from '../../../lib/teact/teact';
import {
  useEffect,
  useRef,
} from '../../../lib/teact/teact';

import type { Signal } from '../../../util/signals';
import type { RichInputKeyboardListener } from './Keyboard';
import type { PasteCtx } from './RichEditable';

import useLastCallback from '../../../hooks/useLastCallback';

import { RichEditable } from './RichEditable';

export type RichInputCtx = {
  editable: RichEditable;
  getHtml: Signal<string>;
};

export function useRichEditable(): RichInputCtx & { ctx: RichInputCtx } {
  const richEditable: RefObject<RichEditable | undefined> = useRef(undefined);
  if (!richEditable.current) {
    richEditable.current = new RichEditable();
  }

  const ctx: RichInputCtx = {
    getHtml: richEditable.current.htmlS,
    editable: richEditable.current,
  };

  return { ...ctx, ctx };
}

export function useRichEditableKeyboardListener(
  richInputCtx: RichInputCtx,
  handler: RichInputKeyboardListener,
  enable = true,
) {
  const keydownCallback = useLastCallback(handler.onKeydown);
  const { priority } = handler;

  useEffect(() => {
    if (!enable) return () => {};

    return richInputCtx.editable.addKeyboardHandler({
      priority,
      onKeydown: keydownCallback,
    });
  }, [richInputCtx.editable, keydownCallback, priority, enable]);
}

export function useRichEditablePasteHandler(
  richInputCtx: RichInputCtx,
  handler: (p: PasteCtx) => void,
  enable = true,
) {
  const keydownCallback = useLastCallback(handler);

  useEffect(() => {
    if (!enable) return () => {};

    return richInputCtx.editable.addPasteHandler(keydownCallback);
  }, [richInputCtx.editable, keydownCallback, enable]);
}
