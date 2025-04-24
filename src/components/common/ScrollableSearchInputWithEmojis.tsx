import { getActions, getGlobal } from "../../global";
import { selectCanAnimateInterface } from "../../global/selectors";
import useAppLayout from "../../hooks/useAppLayout";
import useHorizontalScroll from "../../hooks/useHorizontalScroll";
import useLang from "../../hooks/useLang";
import React, {
  FC,
  memo,
  useEffect,
  useRef,
  useState,
} from "../../lib/teact/teact";
import animateHorizontalScroll from "../../util/animateHorizontalScroll";
import buildClassName from "../../util/buildClassName";
import Button from "../ui/Button";
import SearchInput from "../ui/SearchInput";
import { HEADER_BUTTON_WIDTH } from "./CustomEmojiPicker";
import emojiPickerStyles from "./CustomEmojiPicker.module.scss";
import Icon from "./icons/Icon";

type OwnProps = {
  onBlur: () => void;
  onFocus: () => void;
  emojiQuery: string;
  isInputFocused: boolean;
  onChange: (emojiQuery: string) => void;
  onReset: () => void;
  className?: string;
  inputId?: string;
};


const ScrollableSearchInputWithEmojis: FC<OwnProps> = ({
  onBlur,
  onReset,
  onFocus,
  emojiQuery,
  isInputFocused,
  className,
  onChange,
  inputId,
}) => {
  const lang = useLang();
  const headerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useAppLayout();

  useHorizontalScroll(headerRef, isMobile);
  const [activeSetIndex, setActiveSetIndex] = useState(0);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft =
      activeSetIndex * HEADER_BUTTON_WIDTH -
      (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [activeSetIndex]);

  const canAnimate = selectCanAnimateInterface(getGlobal());


  return (
    <SearchInput
      onBlur={onBlur}
      onFocus={onFocus}
      value={emojiQuery}
      hasTransition={false}
      onReset={onReset}
      className={buildClassName(
        emojiPickerStyles.SearchInput,
        className,
        "with-emojis",
      )}
      // lang pack should have a proper key
      // placeholder={lang("Search Emoji")}
      onChange={onChange}
      inputId={inputId ?? ""}
      children={
        <div className={buildClassName("placeholder-with-categories")}>
          {
            <>
              <div
                className={buildClassName(
                  "emoji-categories",
                  "no-scrollbar",
                  emojiQuery && "hidden",
                  canAnimate && "animated",
                )}
                ref={headerRef}
                >
                <p
                  className={buildClassName(
                    emojiQuery && "hidden",
                    canAnimate && "animated",
                  )}
                  >
                  {/* @ts-ignore */}
                  {lang("Search Emoji")}
                </p>

                <div>
                  <Icon name="msg-emoji-heart" />
                  <Icon name="msg-emoji-like" />
                  <Icon name="msg-emoji-dislike" />
                  <Icon name="msg-emoji-party" />
                  <Icon name="msg-emoji-haha" />
                  <Icon name="msg-emoji-omg" />
                  <Icon name="msg-emoji-sad" />
                  <Icon name="msg-emoji-sad" />
                  <Icon name="msg-emoji-angry" />
                  <Icon name="msg-emoji-neutral" />
                  <Icon name="msg-emoji-what" />
                  <Icon name="msg-emoji-tongue" />
                  <Icon name="msg-emoji-happy" />
                  <Icon name="msg-emoji-activities2" />
                  <Icon name="msg-emoji-away" />
                  <Icon name="msg-emoji-bath" />
                  <Icon name="msg-emoji-busy" />
                  <Icon name="msg-emoji-food" />
                  <Icon name="msg-emoji-hi2" />
                  <Icon name="msg-emoji-home" />
                  <Icon name="msg-emoji-sleep" />
                  <Icon name="msg-emoji-study" />
                  <Icon name="msg-emoji-vacation3" />
                  <Icon name="msg-emoji-work" />
                </div>
              </div>
            </>
          }
          {
            <Button
              round
              size="tiny"
              color="translucent"
              onClick={onReset}
              className={buildClassName(
                "close-button",
                emojiQuery && "visible",
                canAnimate && "animated",
              )}
            >
              <Icon name="close" />
            </Button>
          }
        </div>
      }
      // withBackIcon={isInputFocused}
    />
  );
};

export default memo(ScrollableSearchInputWithEmojis);
