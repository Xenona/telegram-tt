import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect } from '../../../lib/teact/teact';

import type { RichInputCtx } from './useRichEditable';

import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';

import RichEditableAttachment from './RichEditableAttachment';
import TextFormatter from './TextFormatter.async';

import style from './RichInput.module.scss';

type OwnProps = {
  className?: string;
  placeholder?: string;
  richInputCtx: RichInputCtx;
};

const RichInput: FC<OwnProps> = ({ richInputCtx, className, placeholder }) => {
  const fullClass = buildClassName(className, 'form-control', style.RichInput);
  const [isTextFormatterOpen, openTextFormatter, closeTextFormatter] = useFlag();

  useEffect(() => {
    const sel = richInputCtx.editable.selectionS();
    // console.log("FFF", sel)
    if (!sel) return;
    if (!sel?.collapsed) openTextFormatter();
  }, [richInputCtx.editable, richInputCtx.editable.selectionS]);

  return (
    <div className={style.RichInputContainer}>
      <RichEditableAttachment
        richInputCtx={richInputCtx}
        placeholder={placeholder}
        className={fullClass}
      />
      <TextFormatter
        richInputCtx={richInputCtx}
        isOpen={isTextFormatterOpen}
        onClose={closeTextFormatter}
      />
    </div>
  );
};

export default memo(RichInput);
