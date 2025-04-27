import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect } from '../../../lib/teact/teact';

import type { RichInputCtx } from './useRichEditable';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import useDerivedState from '../../../hooks/useDerivedState';
import useFlag from '../../../hooks/useFlag';

import RichEditableAttachment from './RichEditableAttachment';
import TextFormatter from './TextFormatter.async';

import style from './RichInput.module.scss';

type OwnProps = {
  className?: string;
  placeholder?: string;
  richInputCtx: RichInputCtx;
  limitRemaining?: number;
  disablePreview?: boolean;
};

const RichInput: FC<OwnProps> = ({
  richInputCtx, className, placeholder, limitRemaining, disablePreview,
}) => {
  const fullClass = buildClassName(className,
    'form-control',
    style.RichInput,
    (limitRemaining !== undefined && limitRemaining < 0) && 'danger');
  const [isTextFormatterOpen, openTextFormatter, closeTextFormatter] = useFlag();

  useEffect(() => {
    const sel = richInputCtx.editable.selectionS();
    if (!sel) return;
    if (!sel?.collapsed) openTextFormatter();
  }, [richInputCtx.editable, richInputCtx.editable.selectionS]);

  const isTouched = useDerivedState(
    () => Boolean(!richInputCtx.editable.emptyS()),
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [richInputCtx.editable.emptyS, richInputCtx.editable],
  );

  return (
    <div className={style.RichInputContainer}>
      <div className={fullClass}>
        <RichEditableAttachment
          richInputCtx={richInputCtx}
          placeholder={placeholder}
        />
        <span
          className={buildClassName(
            style.placeholderText,
            isTouched && style.touched,
          )}
          dir="auto"
        >
          {placeholder}
        </span>
      </div>
      {limitRemaining !== undefined && limitRemaining < 10 && (
        <div
          style={buildStyle(limitRemaining < 0 && 'color: var(--color-error)')}
          className="max-length-indicator"
        >{limitRemaining}
        </div>
      )}

      <TextFormatter
        richInputCtx={richInputCtx}
        isOpen={isTextFormatterOpen}
        isActive
        onClose={closeTextFormatter}
        disablePreview={disablePreview}
      />
    </div>
  );
};

export default memo(RichInput);
