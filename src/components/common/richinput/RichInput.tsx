import useDynamicColorListener from "../../../hooks/stickers/useDynamicColorListener";
import { requestMutation } from "../../../lib/fasterdom/fasterdom";
import React, { FC, memo, useEffect, useRef } from "../../../lib/teact/teact";
import RichEditableAttachment from "./RichEditableAttachment";
import { RichInputCtx } from "./useRichEditable";
import buildClassName from "../../../util/buildClassName";
import TextFormatter from "./TextFormatter.async";
import useFlag from "../../../hooks/useFlag";

import style from "./RichInput.module.scss";

type OwnProps = {
  className?: string;
  placeholder?: string;
  richInputCtx: RichInputCtx;
};

const RichInput: FC<OwnProps> = ({ richInputCtx, className, placeholder }) => {
  const fullClass = buildClassName(className, "form-control", style.RichInput);
  const [isTextFormatterOpen, openTextFormatter, closeTextFormatter] =
    useFlag();

  useEffect(() => {
    const sel = richInputCtx.editable.selectionS();
    // console.log("FFF", sel)
    if(!sel) return;
    if (!sel?.collapsed) openTextFormatter();
  }, [richInputCtx.editable.selectionS]);

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
