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
import { HEADER_BUTTON_WIDTH } from "./EsgEmojiPicker";
import emojiPickerStyles from "./CustomEmojiPicker.module.scss";
import Icon from "./icons/Icon";

type OwnProps = {
  onBlur: () => void;
  onFocus: () => void;
  emojiQuery: string;
  isInputFocused: boolean;
  onChange: (emojiQuery: string) => void;
  onGroupSelect: (name: string) => void;
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
  onGroupSelect,
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

  const groups = [
    { name: "msg-emoji-heart", group_name: "Love" },
    { name: "msg-emoji-like", group_name: "Approval" },
    { name: "msg-emoji-dislike", group_name: "Disapproval" },
    { name: "msg-emoji-party", group_name: "Cheers" },
    { name: "msg-emoji-haha", group_name: "Laughter" },
    { name: "msg-emoji-omg", group_name: "Astonishment" },
    { name: "msg-emoji-sad", group_name: "Sadness" },
    { name: "msg-emoji-angry", group_name: "Anger" },
    { name: "msg-emoji-neutral", group_name: "Neutral" },
    { name: "msg-emoji-what", group_name: "Doubt" },
    { name: "msg-emoji-tongue", group_name: "Silly" },
    { name: "msg-emoji-happy", group_name: "" },
    { name: "msg-emoji-activities2", group_name: "" },
    { name: "msg-emoji-away", group_name: "" },
    { name: "msg-emoji-bath", group_name: "" },
    { name: "msg-emoji-busy", group_name: "" },
    { name: "msg-emoji-food", group_name: "" },
    { name: "msg-emoji-hi2", group_name: "" },
    { name: "msg-emoji-home", group_name: "" },
    { name: "msg-emoji-sleep", group_name: "" },
    { name: "msg-emoji-study", group_name: "" },
    { name: "msg-emoji-vacation3", group_name: "" },
    { name: "msg-emoji-work", group_name: "" },
  ];

  const [activeGroup, setActiveGroup] = useState<string|null>(null);

  const onInputReset = () => {
    setActiveGroup(null);
    onReset()
  }

  return (
    <SearchInput
      onBlur={onBlur}
      onFocus={onFocus}
      value={emojiQuery}
      // hasTransition={false}
      withBackIcon={activeGroup !== null}
      backIconAsButton
      onReset={onInputReset}
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
                  {groups.map((group, index) => (
                     <Button
                     round
                     size="tiny"
                     color="translucent"
                     onClick={()=> {
                      onFocus();
                      setActiveGroup(group.group_name);
                      onGroupSelect(group.group_name);
                     }}
                     className={buildClassName(
                       emojiQuery && "visible",
                       canAnimate && "animated",
                     )}
                   >
                     <Icon
                       name={group.name as any}
                     />
                   </Button>
                  ))}

                </div>
              </div>
            </>
          }
          {/* {
            <Button
              round
              size="tiny"
              color="translucent"
              onClick={onInputReset}
              className={buildClassName(
                "close-button",
                emojiQuery && "visible",
                canAnimate && "animated",
              )}
            >
              <Icon name="close" />
            </Button>
          } */}
        </div>
      }
      // withBackIcon={isInputFocused}
    />
  );
};

export default memo(ScrollableSearchInputWithEmojis);
