import useDynamicColorListener from "../../../hooks/stickers/useDynamicColorListener";
import { requestMutation } from "../../../lib/fasterdom/fasterdom";
import React, { FC, memo, useEffect, useRef } from "../../../lib/teact/teact";
import { RichInputCtx } from "./useRichInput";

type OwnProps = {
  className?: string;
  disableEdit?: boolean;
  placeholder?: string;
  tabIndex?: number;
  detached?: boolean;
  richInputCtx: RichInputCtx;
};

let nextAttach: (() => void) | null = null;

const RichEditableAttachment: FC<OwnProps> = ({
  richInputCtx,
  className,
  placeholder,
  tabIndex,
  disableEdit,
  detached,
}) => {
  const attachmentRef = useRef<HTMLDivElement>(null);
  const customColor = useDynamicColorListener(attachmentRef, detached);
  const editable = richInputCtx.editable;

  useEffect(() => {
    if (!attachmentRef.current) return;
    if (detached) return;

    const editable = richInputCtx.editable;
    const target = attachmentRef.current;
    
    if(editable.isAttached()) {
      nextAttach = () => {
        editable.attachTo(target);
      }
    } else {
      editable.attachTo(target);
    }

    return () => {
      editable.detachFrom(target);
      nextAttach?.();
      nextAttach = null;
    };
  }, [attachmentRef, richInputCtx.editable, detached]);

  useEffect(() => {
    if (!attachmentRef.current || !editable.isAttached(attachmentRef.current))
      return;

    requestMutation(() => {
      editable.applyRootProperties({
        className,
        disableEdit,
        placeholder,
        tabIndex,
      });
    });
  }, [editable, attachmentRef, className, disableEdit, placeholder, tabIndex]);

  useEffect(() => {
    if (!attachmentRef.current || !editable.isAttached(attachmentRef.current))
      return;

    requestMutation(() => {
      editable.emojiRenderer.setCustomColor(customColor ?? "");
    });
  }, [editable, attachmentRef, customColor]);

  return <div ref={attachmentRef}></div>;
};

export default memo(RichEditableAttachment);
