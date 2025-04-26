import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import { selectCanAnimateInterface } from '../../global/selectors';
import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import SearchInput from '../ui/SearchInput';
import Icon from './icons/Icon';

import emojiPickerStyles from './CustomEmojiPicker.module.scss';

export const HEADER_BUTTON_WIDTH = 2.625 * REM; // px (including margin)

export const manualGroups = [
  { name: 'msg-emoji-happy', keywords: ['happy', 'smile'] },
  { name: 'msg-emoji-activities2', keywords: ['sport', 'art', ] },
  { name: 'msg-emoji-away', keywords: ['vacation', 'holiday'] },
  { name: 'msg-emoji-bath', keywords: ['bath', 'clean', 'shower', 'nail'] },
  { name: 'msg-emoji-busy', keywords: ['busy', 'stop', 'time', 'work'] },
  { name: 'msg-emoji-food', keywords: ['food', 'tasty'] },
  { name: 'msg-emoji-hi2', keywords: ['hello', 'nice', 'hand'] },
  { name: 'msg-emoji-home', keywords: ['home', 'city', 'house'] },
  { name: 'msg-emoji-sleep', keywords: ['sleep', 'tired'] },
  { name: 'msg-emoji-study', keywords: ['study', 'school', 'write', 'book'] },
  { name: 'msg-emoji-vacation3', keywords: ['vacation', 'holiday'] },
  { name: 'msg-emoji-work', keywords: ['work'] },
]
export const manualGroupNames = manualGroups.map((group) => group.name);

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
  className,
  onChange,
  onGroupSelect,
  inputId,
}) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useAppLayout();

  useHorizontalScroll(headerRef, isMobile, true);
  const [activeSetIndex, setActiveSetIndex] = useState(0);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH
      - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [activeSetIndex]);

  const canAnimate = selectCanAnimateInterface(getGlobal());

  const groups = [
    { name: 'msg-emoji-heart', group_name: 'Love' },
    { name: 'msg-emoji-like', group_name: 'Approval' },
    { name: 'msg-emoji-dislike', group_name: 'Disapproval' },
    { name: 'msg-emoji-party', group_name: 'Cheers' },
    { name: 'msg-emoji-haha', group_name: 'Laughter' },
    { name: 'msg-emoji-omg', group_name: 'Astonishment' },
    { name: 'msg-emoji-sad', group_name: 'Sadness' },
    { name: 'msg-emoji-angry', group_name: 'Anger' },
    { name: 'msg-emoji-neutral', group_name: 'Neutral' },
    { name: 'msg-emoji-what', group_name: 'Doubt' },
    { name: 'msg-emoji-tongue', group_name: 'Silly' },
    { name: 'msg-emoji-happy', group_name: '' },
    { name: 'msg-emoji-activities2', group_name: '' },
    { name: 'msg-emoji-away', group_name: '' },
    { name: 'msg-emoji-bath', group_name: '' },
    { name: 'msg-emoji-busy', group_name: '' },
    { name: 'msg-emoji-food', group_name: '' },
    { name: 'msg-emoji-hi2', group_name: '' },
    { name: 'msg-emoji-home', group_name: '' },
    { name: 'msg-emoji-sleep', group_name: '' },
    { name: 'msg-emoji-study', group_name: '' },
    { name: 'msg-emoji-vacation3', group_name: '' },
    { name: 'msg-emoji-work', group_name: '' },
  ];

  const [activeGroup, setActiveGroup] = useState<string | undefined>(undefined);

  const onInputReset = useLastCallback(() => {
    setActiveGroup(undefined);
    onGroupSelect('');
    onReset();
  });

  return (
    <SearchInput
      onBlur={onBlur}
      onFocus={onFocus}
      value={emojiQuery}
      // hasTransition={false}
      withBackIcon={activeGroup !== undefined}
      backIconAsButton
      onReset={onInputReset}
      className={buildClassName(
        emojiPickerStyles.SearchInput,
        className,
        'with-emojis',
      )}
      // lang pack should have a proper key
      // placeholder={lang("Search Emoji")}
      onChange={onChange}
      inputId={inputId ?? ''}
    >
      <div className={buildClassName('placeholder-with-categories')}>

        <div
          className={buildClassName(
            'emoji-categories',
            'no-scrollbar',
            emojiQuery && 'hidden',
            canAnimate && 'animated',
          )}
          ref={headerRef}
        >
          <p
            className={buildClassName(
              emojiQuery && 'hidden',
              canAnimate && 'animated',
            )}
          >
            {/* @ts-ignore */}
            {lang('Search Emoji')}
          </p>

          <div>
            {groups.map((group, index) => (
              <Button
                round
                size="tiny"
                color="translucent"
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => {
                  onFocus();
                  setActiveSetIndex(index);
                  setActiveGroup(group.name);
                  onGroupSelect(group.group_name ? group.group_name : group.name);
                }}
                className={buildClassName(
                  emojiQuery && 'visible',
                  canAnimate && 'animated',
                  activeGroup === group.name && 'activatedIcon',
                )}
              >
                <Icon
                  name={group.name as any}
                />
              </Button>
            ))}

          </div>
        </div>

      </div>
    </SearchInput>
  );
};

export default memo(ScrollableSearchInputWithEmojis);
