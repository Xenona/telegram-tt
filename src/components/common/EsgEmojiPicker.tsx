import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiAvailableReaction,
  ApiEmojiStatusType,
  ApiReaction,
  ApiReactionWithPaid,
  ApiSticker,
  ApiStickerSet,
} from '../../api/types';
import type { GlobalState } from '../../global/types';
import type {
  EmojiKeywords,
  StickerSetOrReactionsSetOrRecent,
} from '../../types';
import type {
  EmojiData,
  EmojiModule,
  EmojiRawData,
} from '../../util/emoji/emoji';

import {
  BASE_EMOJI_KEYWORD_LANG,
  COLLECTIBLE_STATUS_SET_ID,
  EMOJI_SIZE_PICKER,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
  TOP_SYMBOL_SET_ID,
} from '../../config';
import { isSameReaction } from '../../global/helpers';
import {
  selectCanPlayAnimatedEmojis,
  selectChatFullInfo,
  selectIsAlwaysHighPriorityEmoji,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
} from '../../global/selectors';
import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import animateScroll from '../../util/animateScroll';
import buildClassName from '../../util/buildClassName';
import {
  uncompressEmoji,
} from '../../util/emoji/emoji';
import { pickTruthy, unique, uniqueByField } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import windowSize from '../../util/windowSize';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useFlag from '../../hooks/useFlag';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../hooks/useOldLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useScrolledState from '../../hooks/useScrolledState';
import useAsyncRendering from '../right/hooks/useAsyncRendering';
import {
  FOCUS_MARGIN,
  useStickerPickerObservers,
} from './hooks/useStickerPickerObservers';

import EmojiButton from '../middle/composer/EmojiButton';
import EmojiCategory, {
  EMOJI_MARGIN,
  EMOJI_VERTICAL_MARGIN,
  EMOJI_VERTICAL_MARGIN_MOBILE,
  EMOJIS_PER_ROW_ON_DESKTOP,
  MOBILE_CONTAINER_PADDING,
} from '../middle/composer/EmojiCategory';
import {
  ICONS_BY_CATEGORY,
  INTERSECTION_THROTTLE,
  SMOOTH_SCROLL_DISTANCE,
} from '../middle/composer/EmojiPicker';
import StickerSetCover from '../middle/composer/StickerSetCover';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Icon from './icons/Icon';
import ScrollableSearchInputWithEmojis from './ScrollableSearchInputWithEmojis';
import StickerButton from './StickerButton';
import StickerSet from './StickerSet';

import pickerStyles from '../middle/composer/StickerPicker.module.scss';
import styles from './EsgEmojiPicker.module.scss';

type OwnProps = {
  chatId?: string;
  className?: string;
  pickerListClassName?: string;
  isHidden?: boolean;
  loadAndPlay: boolean;
  idPrefix?: string;
  withDefaultTopicIcons?: boolean;
  selectedReactionIds?: string[];
  isStatusPicker?: boolean;
  isReactionPicker?: boolean;
  isTranslucent?: boolean;
  onCustomEmojiSelect: (sticker: ApiSticker) => void;
  onEmojiSelect: (emoji: string, name: string) => void;
  onReactionSelect?: (reaction: ApiReactionWithPaid) => void;
  onReactionContext?: (reaction: ApiReactionWithPaid) => void;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

type StateProps = {
  emojiKeywords?: Record<string, EmojiKeywords | undefined>;
  customEmojisById?: Record<string, ApiSticker>;
  recentCustomEmojiIds?: string[];
  recentStatusEmojis?: ApiSticker[];
  collectibleStatuses?: ApiEmojiStatusType[];
  chatEmojiSetId?: string;
  topReactions?: ApiReaction[];
  recentReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  stickerSetsById: Record<string, ApiStickerSet>;
  availableReactions?: ApiAvailableReaction[];
  addedCustomEmojiIds?: string[];
  defaultTopicIconsId?: string;
  defaultStatusIconsId?: string;
  customEmojiFeaturedIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  isWithPaidReaction?: boolean;
  recentEmojis?: GlobalState['recentEmojis'];
  emojiGroups?: GlobalState['emojiGroups'];
};

export const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const DEFAULT_ID_PREFIX = 'custom-emoji-set';
const TOP_REACTIONS_COUNT = 16;
const RECENT_REACTIONS_COUNT = 32;
const RECENT_DEFAULT_STATUS_COUNT = 7;
const FADED_BUTTON_SET_IDS = new Set([
  RECENT_SYMBOL_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
]);
const STICKER_SET_IDS_WITH_COVER = new Set([
  RECENT_SYMBOL_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
]);
let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;
const categoryIntersections: boolean[] = [];
const { loadEmojiKeywords } = getActions();

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;
    loadEmojiKeywords({ language: BASE_EMOJI_KEYWORD_LANG });
    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}
type EmojiCategoryData = { id: string; name: string; emojis: string[] };

const EsgEmojiPicker: FC<OwnProps & StateProps> = ({
  emojiKeywords,
  className,
  pickerListClassName,
  isHidden,
  loadAndPlay,
  addedCustomEmojiIds,
  customEmojisById,
  recentCustomEmojiIds,
  selectedReactionIds,
  recentStatusEmojis,
  collectibleStatuses,
  stickerSetsById,
  chatEmojiSetId,
  topReactions,
  recentReactions,
  availableReactions,
  idPrefix = DEFAULT_ID_PREFIX,
  customEmojiFeaturedIds,
  canAnimate,
  recentEmojis,
  emojiGroups,
  isReactionPicker,
  isStatusPicker,
  isTranslucent,
  isSavedMessages,
  isCurrentUserPremium,
  withDefaultTopicIcons,
  defaultTopicIconsId,
  defaultStatusIconsId,
  defaultTagReactions,
  isWithPaidReaction,
  onCustomEmojiSelect,
  onEmojiSelect,
  onReactionSelect,
  onReactionContext,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);
  const [isInputFocused, setFocused, setUnfocused] = useFlag();
  const [emojisFound, setEmojisFound] = useState<(Emoji | ApiSticker)[]>([]);
  const [emojisCategoryFound, setEmojisCategoryFound] = useState<(Emoji | ApiSticker)[]
    >([]);
  const [emojiQuery, setEmojiQuery] = useState<string>('');
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [emojis, setEmojis] = useState<AllEmojis>();

  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();
  const textToEmojiMap = useMemo(() => {
    const textToEmoji: Map<string, (Emoji | ApiSticker)[]> = new Map();
    for (const emoji of Object.values(emojis ?? {})) {
      const em = 'native' in emoji ? emoji : Object.values(emoji)[0];
      const arr = textToEmoji.get(em.native) ?? [];
      arr.push(em);
      textToEmoji.set(em.native, arr);
    }

    for (const custEm of Object.values(customEmojisById ?? {})) {
      if (!custEm?.emoji) continue;

      const arr = textToEmoji.get(custEm.emoji) ?? [];
      arr.push(custEm);
      textToEmoji.set(custEm.emoji, arr);
    }

    return textToEmoji;
  }, [emojis, customEmojisById]);

  const recentCustomEmojis = useMemo(() => {
    return isStatusPicker
      ? recentStatusEmojis
      : Object.values(pickTruthy(customEmojisById!, recentCustomEmojiIds!));
  }, [
    customEmojisById,
    isStatusPicker,
    recentCustomEmojiIds,
    recentStatusEmojis,
  ]);

  const collectibleStatusEmojis = useMemo(() => {
    const collectibleStatusEmojiIds = collectibleStatuses?.map(
      (status) => status.documentId,
    );
    return (
      customEmojisById
      && collectibleStatusEmojiIds
        ?.map((id) => customEmojisById[id])
        .filter(Boolean)
    );
  }, [customEmojisById, collectibleStatuses]);

  const prefix = `${idPrefix}-custom-emoji`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const canLoadAndPlay = usePrevDuringAnimation(
    loadAndPlay || undefined,
    SLIDE_TRANSITION_DURATION,
  );

  const oldLang = useOldLang();
  const lang = useLang();

  const areAddedLoaded = Boolean(addedCustomEmojiIds);
  const handleEmojiSearchQueryChange = useDebouncedCallback(
    (query: string) => {
      setEmojiQuery(query.toLowerCase());

      const arr: Set<Emoji | ApiSticker> = new Set();

      for (const emKw of Object.values(emojiKeywords ?? {})) {
        if (!emKw || !emKw.keywords) continue;
        for (const [kw, emojisKws] of Object.entries(emKw.keywords)) {
          if (!kw.includes(query)) continue;

          for (const em of emojisKws) {
            for (const e of textToEmojiMap.get(em) ?? []) {
              arr.add(e);
            }
          }
        }
      }
      setEmojisFound([...arr.values()]);
      if (query === '') {
        setEmojisFound([]);
        setEmojisCategoryFound([]);
      }
    },
    [emojiKeywords, textToEmojiMap],
    300,
    true,
  );

  const handleEmojiGroupSelect = useLastCallback((category: string) => {
    const groupCat = emojiGroups?.find((g) => g.title === category);
    if (!groupCat) return;

    const arr: Set<Emoji | ApiSticker> = new Set();

    for (const em of groupCat?.emoticons) {
      for (const e of textToEmojiMap.get(em) ?? []) {
        arr.add(e);
      }
    }

    setEmojisCategoryFound([...arr.values()]);
  });

  // eslint-disable-next-line no-null/no-null
  const sharedSearchCanvasRef = useRef<HTMLCanvasElement>(null);

  const allSets = useMemo(() => {
    const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];

    if (isReactionPicker && isSavedMessages) {
      if (defaultTagReactions?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: oldLang('PremiumPreviewTags'),
          reactions: defaultTagReactions,
          count: defaultTagReactions.length,
          isEmoji: true,
        });
      }
    }

    if (isReactionPicker && !isSavedMessages) {
      const topReactionsSlice: ApiReactionWithPaid[] = topReactions?.slice(0, TOP_REACTIONS_COUNT) || [];
      if (isWithPaidReaction) {
        topReactionsSlice.unshift({ type: 'paid' });
      }
      if (topReactionsSlice?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: oldLang('Reactions'),
          reactions: topReactionsSlice,
          count: topReactionsSlice.length,
          isEmoji: true,
        });
      }

      const cleanRecentReactions = (recentReactions || [])
        .filter(
          (reaction) => !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction)),
        )
        .slice(0, RECENT_REACTIONS_COUNT);
      const cleanAvailableReactions = (availableReactions || [])
        .filter(({ isInactive }) => !isInactive)
        .map(({ reaction }) => reaction)
        .filter((reaction) => {
          return (
            !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction))
            && !cleanRecentReactions.some((topReaction) => isSameReaction(topReaction, reaction))
          );
        });
      if (cleanAvailableReactions?.length || cleanRecentReactions?.length) {
        const isPopular = !cleanRecentReactions?.length;
        const allRecentReactions = cleanRecentReactions.concat(
          cleanAvailableReactions,
        );
        defaultSets.push({
          id: isPopular ? POPULAR_SYMBOL_SET_ID : RECENT_SYMBOL_SET_ID,
          accessHash: '',
          title: oldLang(isPopular ? 'PopularReactions' : 'RecentStickers'),
          reactions: allRecentReactions,
          count: allRecentReactions.length,
          isEmoji: true,
        });
      }
    } else if (isStatusPicker) {
      const defaultStatusIconsPack = stickerSetsById[defaultStatusIconsId!];
      if (defaultStatusIconsPack?.stickers?.length) {
        const stickers = uniqueByField(
          defaultStatusIconsPack.stickers
            .slice(0, RECENT_DEFAULT_STATUS_COUNT)
            .concat(recentCustomEmojis || []),
          'id',
        );
        // defaultSets.push({
        //   ...defaultStatusIconsPack,
        //   stickers,
        //   count: stickers.length,
        //   id: RECENT_SYMBOL_SET_ID,
        //   title: oldLang('RecentStickers'),
        //   isEmoji: true,
        // });
      }
      if (collectibleStatusEmojis?.length) {
        defaultSets.push({
          id: COLLECTIBLE_STATUS_SET_ID,
          accessHash: '',
          count: collectibleStatusEmojis.length,
          stickers: collectibleStatusEmojis,
          title: lang('CollectibleStatusesCategory'),
          isEmoji: true,
        });
      }
    } else if (withDefaultTopicIcons) {
      const defaultTopicIconsPack = stickerSetsById[defaultTopicIconsId!];
      if (defaultTopicIconsPack.stickers?.length) {
        // defaultSets.push({
        //   ...defaultTopicIconsPack,
        //   id: RECENT_SYMBOL_SET_ID,
        //   title: oldLang('RecentStickers'),
        // });
      }
    } else if (recentCustomEmojis?.length) {
      // defaultSets.push({
      //   id: RECENT_SYMBOL_SET_ID,
      //   accessHash: '0',
      //   title: oldLang('RecentStickers'),
      //   stickers: recentCustomEmojis,
      //   count: recentCustomEmojis.length,
      //   isEmoji: true,
      // });
    }

    const userSetIds = [...(addedCustomEmojiIds || [])];
    if (chatEmojiSetId) {
      userSetIds.unshift(chatEmojiSetId);
    }

    const setIdsToDisplay = unique(
      userSetIds.concat(customEmojiFeaturedIds || []),
    );

    const setsToDisplay = Object.values(
      pickTruthy(stickerSetsById, setIdsToDisplay),
    );

    return [...defaultSets, ...setsToDisplay];
  }, [
    addedCustomEmojiIds,
    isReactionPicker,
    isStatusPicker,
    withDefaultTopicIcons,
    recentCustomEmojis,
    customEmojiFeaturedIds,
    stickerSetsById,
    topReactions,
    availableReactions,
    oldLang,
    recentReactions,
    defaultStatusIconsId,
    defaultTopicIconsId,
    isSavedMessages,
    defaultTagReactions,
    chatEmojiSetId,
    isWithPaidReaction,
    collectibleStatusEmojis,
    lang,
  ]);

  const noPopulatedSets = useMemo(
    () => areAddedLoaded
      && allSets.filter((set) => set.stickers?.length).length === 0,
    [allSets, areAddedLoaded],
  );

  const canRenderContent = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContent = areAddedLoaded && canRenderContent && !noPopulatedSets;

  useHorizontalScroll(headerRef, isMobile || !shouldRenderContent);

  // Initialize data on first render.
  useEffect(() => {
    setTimeout(() => {
      const exec = () => {
        setCategories(emojiData.categories);
        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData().then(exec);
      }
    }, 300); // OPEN_ANIMATION_DELAY
  }, []);

  // Scroll container and header when active set changes

  useEffect(() => {
    if (!areAddedLoaded) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH
      - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

  const handleEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
  });
  const categoryIntersections: boolean[] = [];

  const { observe: observeIntersection } = useIntersectionObserver(
    {
      rootRef: containerRef,
      throttleMs: INTERSECTION_THROTTLE,
    },
    (entries) => {
      entries.forEach((entry) => {
        const { id } = entry.target as HTMLDivElement;
        if (!id || !id.startsWith('emoji-category-')) {
          return;
        }

        const index = Number(id.replace('emoji-category-', ''));
        categoryIntersections[index] = entry.isIntersecting;
      });

      const minIntersectingIndex = categoryIntersections.reduce(
        (lowestIndex, isIntersecting, index) => {
          return isIntersecting && index < lowestIndex ? index : lowestIndex;
        },
        Infinity,
      );

      if (minIntersectingIndex === Infinity) {
        return;
      }
      setActiveCategoryIndex(minIntersectingIndex);
    },
  );

  function renderCover(
    stickerSet: StickerSetOrReactionsSetOrRecent,
    index: number,
  ) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(
      pickerStyles.stickerCover,
      index === activeSetIndex && styles.activated,
    );

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(
      getGlobal(),
      stickerSet as ApiStickerSet,
    );

    if (stickerSet.id === TOP_SYMBOL_SET_ID) {
      return undefined;
    }

    if (
      STICKER_SET_IDS_WITH_COVER.has(stickerSet.id)
      || stickerSet.hasThumbnail
      || !firstSticker
    ) {
      const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID
        || stickerSet.id === POPULAR_SYMBOL_SET_ID;
      const isFaded = FADED_BUTTON_SET_IDS.has(stickerSet.id);
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={isFaded}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectStickerSet(isRecent ? 0 : index)}
        >
          {isRecent ? (
            <Icon name="recent" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !canLoadAndPlay}
              forcePlayback
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={
                withSharedCanvas
                  ? isHq
                    ? sharedCanvasHqRef
                    : sharedCanvasRef
                  : undefined
              }
            />
          )}
        </Button>
      );
    }

    return (
      <StickerButton
        key={stickerSet.id}
        sticker={firstSticker}
        size={STICKER_SIZE_PICKER_HEADER}
        title={stickerSet.title}
        className={buttonClassName}
        noPlay={!canAnimate || !canLoadAndPlay}
        observeIntersection={observeIntersectionForCovers}
        noContextMenu
        isCurrentUserPremium
        sharedCanvasRef={
          withSharedCanvas
            ? isHq
              ? sharedCanvasHqRef
              : sharedCanvasRef
            : undefined
        }
        withTranslucentThumb={isTranslucent}
        onClick={selectStickerSet}
        clickArg={index}
        forcePlayback
      />
    );
  }
  const allCategories = useMemo(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }
    const themeCategories = [...categories];
    if (recentEmojis?.length) {
      themeCategories.unshift({
        id: RECENT_SYMBOL_SET_ID,
        name: lang('RecentStickers'),
        emojis: recentEmojis,
      });
    }

    return themeCategories;
  }, [categories, lang, recentEmojis]);

  const fullClassName = buildClassName(
    'StickerPicker',
    styles.root,
    className,
    'esg-searcheable',
  );

  if (!shouldRenderContent) {
    return (
      <div className={fullClassName}>
        {noPopulatedSets ? (
          <div className={pickerStyles.pickerDisabled}>
            {oldLang('NoStickers')}
          </div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  const headerClassName = buildClassName(
    pickerStyles.header,
    'no-scrollbar',
    !shouldHideTopBorder && pickerStyles.headerWithBorder,
  );
  const listClassName = buildClassName(
    pickerStyles.main,
    pickerStyles.main_customEmoji,
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    pickerListClassName,
    pickerStyles.hasHeader,
  );

  const onReset = () => {
    setEmojiQuery('');
    setEmojisFound([]);
    setEmojisCategoryFound([]);
  };

  const selectCategory = useLastCallback((index: number) => {
    setActiveCategoryIndex(index);
    let categoryEl;

    if (index == 0) {
      categoryEl = containerRef.current!.querySelector(
        '#emoji-search',
      )! as HTMLElement;
    } else {
      categoryEl = containerRef.current!.querySelector(
        `#emoji-category-${index}`,
      )! as HTMLElement;
    }

    animateScroll({
      container: containerRef.current!,
      element: categoryEl,
      position: 'start',
      margin: FOCUS_MARGIN,
      maxDistance: SMOOTH_SCROLL_DISTANCE,
    });
  });

  useEffect(() => {
    if (containerRef.current) {
      selectCategory(0);
    }
  }, [containerRef.current]);

  function renderCategoryButton(category: EmojiCategoryData, index: number) {
    const icon = ICONS_BY_CATEGORY[category.id];

    return (
      icon && (
        <Button
          className={`${pickerStyles.stickerCover} ${styles.symbolSetButton} ${
            index === activeCategoryIndex ? 'activated' : ''
          }`}
          round
          faded
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectCategory(index)}
          ariaLabel={category.name}
        >
          <Icon name={icon} />
        </Button>
      )
    );
  }

  function renderSmiley(smiley: string) {
    const emoji = emojis![smiley];
    // Recent emojis may contain emoticons that are no longer in the list
    if (!emoji) {
      return undefined;
    }
    // Some emojis have multiple skins and are represented as an Object with emojis for all skins.
    // For now, we select only the first emoji with 'neutral' skin.
    const displayedEmoji = 'id' in emoji ? emoji : emoji[1];

    return (
      <EmojiButton
        key={displayedEmoji.id}
        emoji={displayedEmoji}
        onClick={onEmojiSelect}
      />
    );
  }

  return (
    <div className={fullClassName}>
      <div
        ref={headerRef}
        className={buildClassName(
          headerClassName,
          isInputFocused || emojiQuery ? styles.headerHide : '',
          canAnimate ? styles.animatedSlide : '',
        )}
      >
        <div className={styles.categoriesEmojis}>
          {renderCategoryButton(allCategories[0], 0)}
          <div
            className={buildClassName(
              styles.emojiCategoryStripe,
              // activeCategoryIndex > 0 &&
              //   activeCategoryIndex < allCategories.length &&
              //   styles.activated,
            )}
          >
            <div className={canAnimate ? styles.animatedWidth : ''}>
              {allCategories
                .slice(1)
                .map((e, idx) => renderCategoryButton(e, idx + 1))}
            </div>
          </div>
          <div className="shared-canvas-container">
            <canvas ref={sharedCanvasRef} className="shared-canvas" />
            <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
            {allSets.map(renderCover)}
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleContentScroll}
        className={buildClassName(
          listClassName,
          isInputFocused || emojiQuery ? styles.mainHide : '',
          canAnimate ? styles.animatedSlide : '',
        )}
      >
        <ScrollableSearchInputWithEmojis
          onBlur={setUnfocused}
          onFocus={setFocused}
          onReset={onReset}
          emojiQuery={emojiQuery}
          isInputFocused={isInputFocused}
          // lang pack should have a proper key
          // @ts-ignore
          onChange={handleEmojiSearchQueryChange}
          onGroupSelect={handleEmojiGroupSelect}
          inputId="emoji-search"
        />
        {!emojiQuery && !emojisCategoryFound.length ? (
          <>
            {/* <div className="symbol-set symbol-set-container custom-folder-icon-container">
              {Object.entries(EMOTICON_TO_FOLDER_ICON).map(([emoticon, v]) => (
                <div
                  className="EmojiButton custom-folder-icons"
                  onClick={() => { onIconSelect(emoticon); }}
                >
                  <Icon name={v} />
                </div>
              ))}
            </div> */}
            {allCategories.map((category, i) => {
              if (category.id == RECENT_SYMBOL_SET_ID) {
                const transitionClassNames = useMediaTransitionDeprecated(
                  activeCategoryIndex >= i - 1 && activeCategoryIndex <= i + 1,
                );
                const { isMobile } = useAppLayout();
                const ref = useRef<HTMLDivElement>(null);

                const emojisPerRow = isMobile
                  ? Math.floor(
                    (windowSize.get().width
                        - MOBILE_CONTAINER_PADDING
                        + EMOJI_MARGIN)
                        / (EMOJI_SIZE_PICKER + EMOJI_MARGIN),
                  )
                  : EMOJIS_PER_ROW_ON_DESKTOP;
                const height = Math.ceil(
                  (category.emojis.length
                      + (recentCustomEmojis?.length ?? 0))
                      / emojisPerRow,
                )
                  * (EMOJI_SIZE_PICKER
                    + (isMobile
                      ? EMOJI_VERTICAL_MARGIN_MOBILE
                      : EMOJI_VERTICAL_MARGIN));

                return (
                  <div
                    ref={ref}
                    key={category.id}
                    id={`emoji-category-${0}`}
                    className="symbol-set"
                  >
                    <canvas
                      ref={sharedSearchCanvasRef}
                      className="shared-canvas"
                      style={undefined}
                    />
                    <div className="symbol-set-header">
                      <p className="symbol-set-name" dir="auto">
                        {lang('RecentStickers')}
                      </p>
                    </div>
                    <div
                      className={buildClassName(
                        'symbol-set-container',
                        transitionClassNames,
                      )}
                      style={`height: ${height}px;`}
                      dir={lang.isRtl ? 'rtl' : undefined}
                    >
                      {[...(recentCustomEmojis ?? []), ...category.emojis]
                        .filter((e) => e)
                        .map((e) => (typeof e === 'string' ? (
                          renderSmiley(e)
                        ) : (
                          <StickerButton
                            key={e.id}
                            sticker={e}
                            size={EMOJI_SIZE_PICKER}
                            observeIntersection={
                              observeIntersectionForPlayingItems
                            }
                            observeIntersectionForShowing={
                              observeIntersectionForShowingItems
                            }
                            noPlay={!loadAndPlay}
                            isSavedMessages={isSavedMessages}
                            isStatusPicker={isStatusPicker}
                            canViewSet
                            noContextMenu
                            isCurrentUserPremium={isCurrentUserPremium}
                            shouldIgnorePremium={false}
                            sharedCanvasRef={sharedSearchCanvasRef}
                            withTranslucentThumb={isTranslucent}
                            onClick={onCustomEmojiSelect}
                            clickArg={e}
                            isSelected={false}
                            onUnfaveClick={undefined}
                            onFaveClick={undefined}
                            onRemoveRecentClick={undefined}
                            onContextMenuOpen={onContextMenuOpen}
                            onContextMenuClose={onContextMenuClose}
                            onContextMenuClick={onContextMenuClick}
                            forcePlayback={false}
                            isEffectEmoji={false}
                            noShowPremium
                          />
                        )))}
                    </div>
                  </div>
                );
                // return <div>srse</div>;
              } else {
                return (
                  <EmojiCategory
                    category={category}
                    index={i}
                    allEmojis={emojis!}
                    observeIntersection={observeIntersection}
                    shouldRender={
                      activeCategoryIndex >= i - 1
                      && activeCategoryIndex <= i + 1
                    }
                    onEmojiSelect={onEmojiSelect}
                  />
                );
              }
            })}
            {allSets.map((stickerSet, i) => {
              const shouldHideHeader = stickerSet.id === TOP_SYMBOL_SET_ID
                || (stickerSet.id === RECENT_SYMBOL_SET_ID
                  && (withDefaultTopicIcons || isStatusPicker));
              const isChatEmojiSet = stickerSet.id === chatEmojiSetId;

              if (stickerSet.id === RECENT_SYMBOL_SET_ID) return undefined;

              return (
                <StickerSet
                  key={stickerSet.id}
                  stickerSet={stickerSet}
                  loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
                  index={i}
                  idPrefix={prefix}
                  observeIntersection={observeIntersectionForSet}
                  observeIntersectionForPlayingItems={
                    observeIntersectionForPlayingItems
                  }
                  observeIntersectionForShowingItems={
                    observeIntersectionForShowingItems
                  }
                  isNearActive={
                    activeSetIndex >= i - 1 && activeSetIndex <= i + 1
                  }
                  isSavedMessages={isSavedMessages}
                  folderIconPick
                  isStatusPicker={isStatusPicker}
                  isReactionPicker={isReactionPicker}
                  shouldHideHeader={shouldHideHeader}
                  withDefaultTopicIcon={
                    withDefaultTopicIcons
                    && stickerSet.id === RECENT_SYMBOL_SET_ID
                  }
                  withDefaultStatusIcon={
                    isStatusPicker && stickerSet.id === RECENT_SYMBOL_SET_ID
                  }
                  isChatEmojiSet={isChatEmojiSet}
                  isCurrentUserPremium={isCurrentUserPremium}
                  selectedReactionIds={selectedReactionIds}
                  availableReactions={availableReactions}
                  isTranslucent={isTranslucent}
                  onReactionSelect={onReactionSelect}
                  onReactionContext={onReactionContext}
                  onStickerSelect={onCustomEmojiSelect}
                  onContextMenuOpen={onContextMenuOpen}
                  onContextMenuClose={onContextMenuClose}
                  onContextMenuClick={onContextMenuClick}
                  forcePlayback
                />
              );
            })}
          </>
        ) : emojisFound.length ? (
          <div className="symbol-set symbol-set-container">
            <canvas
              ref={sharedSearchCanvasRef}
              className="shared-canvas"
              style={undefined}
            />
            {emojisFound.map((e) => ('native' in e ? (
              <EmojiButton key={e.id} emoji={e} onClick={onEmojiSelect} />
            ) : (
              <StickerButton
                key={e.id}
                sticker={e}
                size={EMOJI_SIZE_PICKER}
                observeIntersection={observeIntersectionForPlayingItems}
                observeIntersectionForShowing={
                  observeIntersectionForShowingItems
                }
                noPlay={!loadAndPlay}
                isSavedMessages={isSavedMessages}
                isStatusPicker={isStatusPicker}
                canViewSet
                noContextMenu
                isCurrentUserPremium={isCurrentUserPremium}
                shouldIgnorePremium={false}
                sharedCanvasRef={sharedSearchCanvasRef}
                withTranslucentThumb={isTranslucent}
                onClick={onCustomEmojiSelect}
                clickArg={e}
                isSelected={false}
                onUnfaveClick={undefined}
                onFaveClick={undefined}
                onRemoveRecentClick={undefined}
                onContextMenuOpen={onContextMenuOpen}
                onContextMenuClose={onContextMenuClose}
                onContextMenuClick={onContextMenuClick}
                forcePlayback={false}
                isEffectEmoji={false}
                noShowPremium
              />
            )))}
          </div>
        ) : emojisCategoryFound.length ? (
          <div className="symbol-set symbol-set-container">
            <canvas
              ref={sharedSearchCanvasRef}
              className="shared-canvas"
              style={undefined}
            />
            {emojisCategoryFound.map((e) => ('native' in e ? (
              <EmojiButton key={e.id} emoji={e} onClick={onEmojiSelect} />
            ) : (
              <StickerButton
                key={e.id}
                sticker={e}
                size={EMOJI_SIZE_PICKER}
                observeIntersection={observeIntersectionForPlayingItems}
                observeIntersectionForShowing={
                  observeIntersectionForShowingItems
                }
                noPlay={!loadAndPlay}
                isSavedMessages={isSavedMessages}
                isStatusPicker={isStatusPicker}
                canViewSet
                noContextMenu
                isCurrentUserPremium={isCurrentUserPremium}
                shouldIgnorePremium={false}
                sharedCanvasRef={sharedSearchCanvasRef}
                withTranslucentThumb={isTranslucent}
                onClick={onCustomEmojiSelect}
                clickArg={e}
                isSelected={false}
                onUnfaveClick={undefined}
                onFaveClick={undefined}
                onRemoveRecentClick={undefined}
                onContextMenuOpen={onContextMenuOpen}
                onContextMenuClose={onContextMenuClose}
                onContextMenuClick={onContextMenuClick}
                forcePlayback={false}
                isEffectEmoji={false}
                noShowPremium
              />
            )))}
          </div>
        ) : (
          // @ts-ignore
          <p>{lang('No emoji found')}</p>
        )}
      </div>
    </div>
  );
};

export default memo(
  withGlobal<OwnProps>(
    (global, { chatId, isStatusPicker, isReactionPicker }): StateProps => {
      const {
        stickers: { setsById: stickerSetsById },
        emojiKeywords,
        customEmojis: {
          byId: customEmojisById,
          featuredIds: customEmojiFeaturedIds,
          statusRecent: { emojis: recentStatusEmojis },
        },
        recentCustomEmojis: recentCustomEmojiIds,
        reactions: {
          availableReactions,
          recentReactions,
          topReactions,
          defaultTags,
        },
        recentEmojis,
        emojiGroups,
      } = global;

      const isSavedMessages = Boolean(
        chatId && selectIsChatWithSelf(global, chatId),
      );
      const chatFullInfo = chatId
        ? selectChatFullInfo(global, chatId)
        : undefined;
      const collectibleStatuses = global.collectibleEmojiStatuses?.statuses;

      return {
        emojiKeywords,
        customEmojisById,
        recentCustomEmojiIds: !isStatusPicker
          ? recentCustomEmojiIds
          : undefined,
        recentStatusEmojis: isStatusPicker ? recentStatusEmojis : undefined,
        collectibleStatuses: isStatusPicker ? collectibleStatuses : undefined,
        stickerSetsById,
        addedCustomEmojiIds: global.customEmojis.added.setIds,
        canAnimate: selectCanPlayAnimatedEmojis(global),
        isSavedMessages,
        isCurrentUserPremium: selectIsCurrentUserPremium(global),
        customEmojiFeaturedIds,
        defaultTopicIconsId: global.defaultTopicIconsId,
        defaultStatusIconsId: global.defaultStatusIconsId,
        topReactions: isReactionPicker ? topReactions : undefined,
        recentReactions: isReactionPicker ? recentReactions : undefined,
        chatEmojiSetId: chatFullInfo?.emojiSet?.id,
        isWithPaidReaction:
          isReactionPicker && chatFullInfo?.isPaidReactionAvailable,
        availableReactions: isReactionPicker ? availableReactions : undefined,
        defaultTagReactions: isReactionPicker ? defaultTags : undefined,
        recentEmojis,
        emojiGroups,
      };
    },
  )(EsgEmojiPicker),
);
