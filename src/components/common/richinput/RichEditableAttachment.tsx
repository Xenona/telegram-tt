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

const RichEditableAttachment: FC<OwnProps> = ({
  richInputCtx,
  className,
  placeholder,
  tabIndex,
  disableEdit,
  detached,
}) => {
  const attachmentRef = useRef<HTMLDivElement>(null);
  const editable = richInputCtx.editable;

  useEffect(() => {
    if (!attachmentRef.current) return;
    if (detached) return;

    const target = attachmentRef.current;
    const editable = richInputCtx.editable;
    editable.attachTo(target);
    return () => {
      editable.detachFrom(target);
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

  return <div ref={attachmentRef}></div>;
};

export default memo(RichEditableAttachment);
