import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';

import type { RichInputCtx } from './useRichEditable';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';

import useDynamicColorListener from '../../../hooks/stickers/useDynamicColorListener';

type OwnProps = {
  className?: string;
  disableEdit?: boolean;
  placeholder?: string;
  tabIndex?: number;
  detached?: boolean;
  richInputCtx: RichInputCtx;
};

let nextAttach: (() => void) | undefined;

const RichEditableAttachment: FC<OwnProps> = ({
  richInputCtx,
  className,
  placeholder,
  tabIndex,
  disableEdit,
  detached,
}) => {
  // eslint-disable-next-line no-null/no-null
  const attachmentRef = useRef<HTMLDivElement>(null);
  const customColor = useDynamicColorListener(attachmentRef, detached);
  const editable = richInputCtx.editable;

  useEffect(() => {
    if (!attachmentRef.current || detached) return () => {};

    const attEditable = richInputCtx.editable;
    const target = attachmentRef.current;

    if (attEditable.isAttached()) {
      nextAttach = () => {
        attEditable.attachTo(target);
      };
    } else {
      attEditable.attachTo(target);
    }

    return () => {
      attEditable.detachFrom(target);
      nextAttach?.();
      nextAttach = undefined;
    };
  }, [attachmentRef, richInputCtx.editable, detached]);

  useEffect(() => {
    if (!attachmentRef.current || !editable.isAttached(attachmentRef.current)) return;

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
    if (!attachmentRef.current || !editable.isAttached(attachmentRef.current)) return;

    requestMutation(() => {
      editable.emojiRenderer.setCustomColor(customColor ?? '');
    });
  }, [editable, attachmentRef, customColor]);

  return <div ref={attachmentRef} />;
};

export default memo(RichEditableAttachment);
