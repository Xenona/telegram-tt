import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat, ApiSticker, ApiStickerSet } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type {
  EmojiKeywords,
  StickerSetOrReactionsSetOrRecent,
  ThreadId,
} from '../../../types';

import {
  CHAT_STICKER_SET_ID,
  EFFECT_EMOJIS_SET_ID,
  EFFECT_STICKERS_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER,
  STICKER_SIZE_PICKER_HEADER,
} from '../../../config';
import { isUserId } from '../../../global/helpers';
import {
  selectChat, selectChatFullInfo, selectIsChatWithSelf, selectIsCurrentUserPremium, selectShouldLoopStickers,
} from '../../../global/selectors';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { pickTruthy } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { REM } from '../../common/helpers/mediaDimensions';

import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useFlag from '../../../hooks/useFlag';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useScrolledState from '../../../hooks/useScrolledState';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import { useStickerPickerObservers } from '../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import ScrollableSearchInputWithEmojis from '../../common/ScrollableSearchInputWithEmojis';
import StickerButton from '../../common/StickerButton';
import StickerSet from '../../common/StickerSet';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import StickerSetCover from './StickerSetCover';

import headerStyles from '../../common/CustomEmojiPicker.module.scss';
import styles from './StickerPicker.module.scss';

type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  className: string;
  isHidden?: boolean;
  isTranslucent?: boolean;
  loadAndPlay: boolean;
  canSendStickers?: boolean;
  noContextMenus?: boolean;
  idPrefix: string;
  onStickerSelect: (
    sticker: ApiSticker,
    isSilent?: boolean,
    shouldSchedule?: boolean,
    canUpdateStickerSetsOrder?: boolean,
  ) => void;
  isForEffects?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  recentStickers: ApiSticker[];
  favoriteStickers: ApiSticker[];
  customEmojisById?: Record<string, ApiSticker>;
  effectStickers?: ApiSticker[];
  effectEmojis?: ApiSticker[];
  emojiKeywords?: Record<string, EmojiKeywords | undefined>;
  stickerSetsById: Record<string, ApiStickerSet>;
  chatStickerSetId?: string;
  addedSetIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  emojiGroups?: GlobalState['emojiGroups'];
};

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const StickerPicker: FC<OwnProps & StateProps> = ({
  chat,
  threadId,
  emojiKeywords,
  className,
  isHidden,
  isTranslucent,
  loadAndPlay,
  customEmojisById,
  canSendStickers,
  emojiGroups,
  recentStickers,
  favoriteStickers,
  effectStickers,
  effectEmojis,
  addedSetIds,
  stickerSetsById,
  chatStickerSetId,
  canAnimate,
  isSavedMessages,
  isCurrentUserPremium,
  noContextMenus,
  idPrefix,
  onStickerSelect,
  isForEffects,
}) => {
  const {
    loadRecentStickers,
    addRecentSticker,
    unfaveSticker,
    faveSticker,
    removeRecentSticker,
    setGifSearchQuery,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isInputFocused, setFocused, setUnfocused] = useFlag();
  const [emojisFound, setEmojisFound] = useState<ApiSticker[]>([]);
  const [emojisCategoryFound, setEmojisCategoryFound] = useState<ApiSticker[]>(
    [],
  );
  // eslint-disable-next-line no-null/no-null
  const sharedSearchCanvasRef = useRef<HTMLCanvasElement>(null);

  const [emojis, setEmojis] = useState<ApiSticker[]>([]);
  const [emojiQuery, setEmojiQuery] = useState<string>('');

  const textToEmojiMap = useMemo(() => {
    const textToEmoji: Map<string, ApiSticker[]> = new Map();
    for (const emojis of Object.values(getGlobal().stickers.setsById)
      .filter((e) => !e.isEmoji)
      .map((s) => s.packs) ?? {}) {
      if (!emojis || Object.keys(emojis).length === 0) continue;
      for (const [emoji, stickers] of Object.entries(emojis)) {
        const arr = textToEmoji.get(emoji) ?? [];
        arr.push(...stickers);
        textToEmoji.set(emoji, arr);
      }
    }

    for (const [emoji, stickers] of textToEmoji.entries()) {
      const seenId = new Set();
      const uniqueStickers = stickers.filter((s) => {
        if (seenId.has(s.id)) {
          return false;
        }
        seenId.add(s.id);
        return true;
      });
      textToEmoji.set(emoji, uniqueStickers);
    }

    return textToEmoji;
  }, [emojis, customEmojisById]);

  const handleEmojiSearchQueryChange = useDebouncedCallback(
    (query: string) => {
      setEmojiQuery(query.toLowerCase());

      const arr: Set<ApiSticker> = new Set();

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

    const arr: Set<ApiSticker> = new Set();

    for (const em of groupCat?.emoticons) {
      for (const e of textToEmojiMap.get(em) ?? []) {
        arr.add(e);
      }
    }

    setEmojisCategoryFound([...arr.values()]);
  });

  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const sendMessageAction = useSendMessageAction(chat?.id, threadId);

  const prefix = `${idPrefix}-sticker-set`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const lang = useOldLang();

  const areAddedLoaded = Boolean(addedSetIds);

  const allSets = useMemo(() => {
    if (isForEffects && effectStickers) {
      const effectSets: StickerSetOrReactionsSetOrRecent[] = [];
      if (effectEmojis?.length) {
        effectSets.push({
          id: EFFECT_EMOJIS_SET_ID,
          accessHash: '0',
          title: '',
          stickers: effectEmojis,
          count: effectEmojis.length,
          isEmoji: true,
        });
      }
      if (effectStickers?.length) {
        effectSets.push({
          id: EFFECT_STICKERS_SET_ID,
          accessHash: '0',
          title: lang('StickerEffects'),
          stickers: effectStickers,
          count: effectStickers.length,
        });
      }
      return effectSets;
    }

    if (!addedSetIds) {
      return MEMO_EMPTY_ARRAY;
    }

    const defaultSets = [];

    if (favoriteStickers.length) {
      defaultSets.push({
        id: FAVORITE_SYMBOL_SET_ID,
        accessHash: '0',
        title: lang('FavoriteStickers'),
        stickers: favoriteStickers,
        count: favoriteStickers.length,
      });
    }

    if (recentStickers.length) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        accessHash: '0',
        title: lang('RecentStickers'),
        stickers: recentStickers,
        count: recentStickers.length,
      });
    }

    const userSetIds = [...(addedSetIds || [])];
    if (chatStickerSetId) {
      userSetIds.unshift(chatStickerSetId);
    }

    const existingAddedSetIds = Object.values(
      pickTruthy(stickerSetsById, userSetIds),
    );

    return [...defaultSets, ...existingAddedSetIds];
  }, [
    addedSetIds,
    stickerSetsById,
    favoriteStickers,
    recentStickers,
    chatStickerSetId,
    lang,
    effectStickers,
    isForEffects,
    effectEmojis,
  ]);

  const noPopulatedSets = useMemo(
    () => areAddedLoaded
      && allSets.filter((set) => set.stickers?.length).length === 0,
    [allSets, areAddedLoaded],
  );

  useEffect(() => {
    if (!loadAndPlay) return;
    loadRecentStickers();
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  }, [canSendStickers, loadAndPlay, loadRecentStickers, sendMessageAction]);

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContents = areAddedLoaded
    && canRenderContents
    && !noPopulatedSets
    && (canSendStickers || isForEffects);

  useHorizontalScroll(headerRef, !shouldRenderContents || !headerRef.current);

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

  const handleStickerSelect = useLastCallback(
    (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => {
      onStickerSelect(sticker, isSilent, shouldSchedule, true);
      addRecentSticker({ sticker });
    },
  );

  const handleStickerUnfave = useLastCallback((sticker: ApiSticker) => {
    unfaveSticker({ sticker });
  });

  const handleStickerFave = useLastCallback((sticker: ApiSticker) => {
    faveSticker({ sticker });
  });

  const handleMouseMove = useLastCallback(() => {
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  });

  const handleRemoveRecentSticker = useLastCallback((sticker: ApiSticker) => {
    removeRecentSticker({ sticker });
  });

  if (!chat) return undefined;

  function renderCover(
    stickerSet: StickerSetOrReactionsSetOrRecent,
    index: number,
  ) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(
      styles.stickerCover,
      index === activeSetIndex && styles.activated,
    );
    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;

    if (
      stickerSet.id === RECENT_SYMBOL_SET_ID
      || stickerSet.id === FAVORITE_SYMBOL_SET_ID
      || stickerSet.id === CHAT_STICKER_SET_ID
      || stickerSet.hasThumbnail
      || !firstSticker
    ) {
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={
            stickerSet.id === RECENT_SYMBOL_SET_ID
            || stickerSet.id === FAVORITE_SYMBOL_SET_ID
          }
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectStickerSet(index)}
        >
          {stickerSet.id === RECENT_SYMBOL_SET_ID ? (
            <Icon name="recent" />
          ) : stickerSet.id === FAVORITE_SYMBOL_SET_ID ? (
            <Icon name="favorite" />
          ) : stickerSet.id === CHAT_STICKER_SET_ID ? (
            <Avatar peer={chat} size="small" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !loadAndPlay}
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
              forcePlayback
            />
          )}
        </Button>
      );
    } else {
      return (
        <StickerButton
          key={stickerSet.id}
          sticker={firstSticker}
          size={STICKER_SIZE_PICKER_HEADER}
          title={stickerSet.title}
          className={buttonClassName}
          noPlay={!canAnimate || !loadAndPlay}
          observeIntersection={observeIntersectionForCovers}
          noContextMenu
          isCurrentUserPremium
          sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
          withTranslucentThumb={isTranslucent}
          onClick={selectStickerSet}
          clickArg={index}
          forcePlayback
        />
      );
    }
  }
  const onReset = () => {
    setEmojiQuery('');
    setEmojisFound([]);
    setEmojisCategoryFound([]);
  };

  const fullClassName = buildClassName(
    'StickerPicker',
    styles.root,
    className,
    'esg-searcheable',
  );

  if (!shouldRenderContents) {
    return (
      <div className={fullClassName}>
        {!canSendStickers && !isForEffects ? (
          <div className={styles.pickerDisabled}>
            {lang('ErrorSendRestrictedStickersAll')}
          </div>
        ) : noPopulatedSets ? (
          <div className={styles.pickerDisabled}>{lang('NoStickers')}</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  const headerClassName = buildClassName(
    styles.header,
    'no-scrollbar',
    isInputFocused || emojiQuery ? headerStyles.headerHide : '',
    canAnimate ? headerStyles.animatedSlide : '',
    !shouldHideTopBorder && styles.headerWithBorder,
  );
  function onlyUniqueById(array: ApiSticker[]) {
    const seenIds = new Set();
    return array.filter((obj) => {
      if (seenIds.has(obj.id)) {
        return false;
      }
      seenIds.add(obj.id);
      return true;
    });
  }

  return (
    <div className={fullClassName}>
      {!isForEffects && (
        <div
          ref={headerRef}
          className={buildClassName(
            headerClassName,

          )}
        >
          <div className="shared-canvas-container">
            <canvas ref={sharedCanvasRef} className="shared-canvas" />
            {allSets.map(renderCover)}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onScroll={handleContentScroll}
        className={buildClassName(
          styles.main,
          IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
          !isForEffects && styles.hasHeader,
          isInputFocused || emojiQuery ? headerStyles.mainHide : '',
          canAnimate ? headerStyles.animatedSlide : '',
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
          placeholder={lang('Search Stickers')}
          onChange={handleEmojiSearchQueryChange}
          onGroupSelect={handleEmojiGroupSelect}
          inputId="emoji-search"
        />
        {!emojiQuery && !emojisCategoryFound.length ? (
          <>
            {allSets.map((stickerSet, i) => (
              <StickerSet
                key={stickerSet.id}
                stickerSet={stickerSet}
                loadAndPlay={Boolean(canAnimate && loadAndPlay)}
                noContextMenus={noContextMenus}
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
                favoriteStickers={favoriteStickers}
                isSavedMessages={isSavedMessages}
                isCurrentUserPremium={isCurrentUserPremium}
                isTranslucent={isTranslucent}
                isChatStickerSet={stickerSet.id === chatStickerSetId}
                onStickerSelect={handleStickerSelect}
                onStickerUnfave={handleStickerUnfave}
                onStickerFave={handleStickerFave}
                onStickerRemoveRecent={handleRemoveRecentSticker}
                forcePlayback
                shouldHideHeader={stickerSet.id === EFFECT_EMOJIS_SET_ID}
              />
            ))}
          </>
        ) : emojisFound.length ? (
          // "Query worked"
          <div className="symbol-set symbol-set-container">
            <canvas
              ref={sharedSearchCanvasRef}
              className="shared-canvas"
              style={undefined}
            />
            {onlyUniqueById(emojisFound).map((e) => (
              <StickerButton
                key={e.id}
                sticker={e}
                size={STICKER_SIZE_PICKER}
                observeIntersection={observeIntersectionForPlayingItems}
                observeIntersectionForShowing={
                  observeIntersectionForShowingItems
                }
                noPlay={!loadAndPlay}
                isSavedMessages={isSavedMessages}
                isStatusPicker={false}
                canViewSet
                noContextMenu
                isCurrentUserPremium={isCurrentUserPremium}
                shouldIgnorePremium={false}
                sharedCanvasRef={sharedSearchCanvasRef}
                withTranslucentThumb={isTranslucent}
                onClick={onStickerSelect}
                clickArg={e}
                isSelected={false}
                onUnfaveClick={undefined}
                onFaveClick={undefined}
                onRemoveRecentClick={undefined}
                onContextMenuOpen={undefined}
                onContextMenuClose={undefined}
                onContextMenuClick={undefined}
                forcePlayback={false}
                isEffectEmoji={false}
                noShowPremium
              />
            ))}
          </div>
        ) : emojisCategoryFound.length ? (
          <div className="symbol-set symbol-set-container">
            <canvas
              ref={sharedSearchCanvasRef}
              className="shared-canvas"
              style={undefined}
            />
            {onlyUniqueById(emojisCategoryFound).map((e) => (
              <StickerButton
                key={e.id}
                sticker={e}
                size={STICKER_SIZE_PICKER}
                observeIntersection={observeIntersectionForPlayingItems}
                observeIntersectionForShowing={
                  observeIntersectionForShowingItems
                }
                noPlay={!loadAndPlay}
                isSavedMessages={isSavedMessages}
                isStatusPicker={false}
                canViewSet
                noContextMenu
                isCurrentUserPremium={isCurrentUserPremium}
                shouldIgnorePremium={false}
                sharedCanvasRef={sharedSearchCanvasRef}
                withTranslucentThumb={isTranslucent}
                onClick={onStickerSelect}
                clickArg={e}
                isSelected={false}
                onUnfaveClick={undefined}
                onFaveClick={undefined}
                onRemoveRecentClick={undefined}
                onContextMenuOpen={undefined}
                onContextMenuClose={undefined}
                onContextMenuClick={undefined}
                forcePlayback={false}
                isEffectEmoji={false}
                noShowPremium
              />
            ))}
          </div>
        ) : (
          'Stickers not found'
        )}
      </div>
    </div>
  );
};

export default memo(
  withGlobal<OwnProps>((global, { chatId }): StateProps => {
    const {
      stickers: {
        setsById, added, recent, favorite, effect,
      },
      customEmojis: { byId: customEmojisById },
      emojiKeywords,
      emojiGroups,
    } = global;

    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const chat = selectChat(global, chatId);
    const chatStickerSetId = !isUserId(chatId)
      ? selectChatFullInfo(global, chatId)?.stickerSet?.id
      : undefined;

    return {
      emojiKeywords,
      chat,
      effectStickers: effect?.stickers,
      effectEmojis: effect?.emojis,
      customEmojisById,
      recentStickers: recent.stickers,
      favoriteStickers: favorite.stickers,
      stickerSetsById: setsById,
      addedSetIds: added.setIds,
      canAnimate: selectShouldLoopStickers(global),
      isSavedMessages,
      emojiGroups,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      chatStickerSetId,
    };
  })(StickerPicker),
);
