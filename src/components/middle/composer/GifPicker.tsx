import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiVideo } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { selectCurrentMessageList, selectIsChatWithSelf } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import GifButton from '../../common/GifButton';
import ScrollableSearchInputWithEmojis from '../../common/ScrollableSearchInputWithEmojis';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';

import './GifPicker.scss';

type OwnProps = {
  className: string;
  loadAndPlay: boolean;
  canSendGifs?: boolean;
  onGifSelect?: (
    gif: ApiVideo,
    isSilent?: boolean,
    shouldSchedule?: boolean,
  ) => void;
};

type StateProps = {
  savedGifs?: ApiVideo[];
  isSavedMessages?: boolean;
  gifSearch: GlobalState['gifSearch'];
};

const INTERSECTION_DEBOUNCE = 300;

const PRELOAD_BACKWARDS = 96; // GIF Search bot results are multiplied by 24

const GifPicker: FC<OwnProps & StateProps> = ({
  className,
  loadAndPlay,
  canSendGifs,
  savedGifs,
  isSavedMessages,
  onGifSelect,
  gifSearch,
}) => {
  const {
    loadSavedGifs, saveGif, setGifSearchQuery, searchMoreGifs,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [emojiQuery, setEmojiQuery] = useState<string>('');

  const [isInputFocused, setFocused, setUnfocused] = useFlag();
  const onReset = useLastCallback(() => {
    setEmojiQuery('');
    // setEmojisFound([]);
    // setEmojisCategoryFound([]);
  });

  const handleEmojiSearchQueryChange = useLastCallback((e: string) => {
    setGifSearchQuery({ query: e, tabId: -1 });
  });

  //   const handleEmojiSearchQueryChange = useDebouncedCallback(
  //   (query: string) => {
  //     setEmojiQuery(query.toLowerCase());

  //     const arr: Set<ApiSticker> = new Set();

  //     for (const emKw of Object.values(emojiKeywords ?? {})) {
  //       if (!emKw || !emKw.keywords) continue;
  //       for (const [kw, emojisKws] of Object.entries(emKw.keywords)) {
  //         if (!kw.includes(query)) continue;

  //         for (const em of emojisKws) {
  //           for (const e of textToEmojiMap.get(em) ?? []) {
  //             arr.add(e);
  //           }
  //         }
  //       }
  //     }
  //     setEmojisFound([...arr.values()]);
  //     if (query === "") {
  //       setEmojisFound([]);
  //       setEmojisCategoryFound([]);
  //     }
  //   },
  //   [emojiKeywords, textToEmojiMap],
  //   300,
  //   true,
  // );

  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE,
  });

  useEffect(() => {
    if (loadAndPlay) {
      loadSavedGifs();
    }
  }, [loadAndPlay, loadSavedGifs]);

  const handleUnsaveClick = useLastCallback((gif: ApiVideo) => {
    saveGif({ gif, shouldUnsave: true });
  });

  const handleEmojiGroupSelect = useLastCallback((category: string) => {
    // const groupCat = emojiGroups?.find((g) => g.title === category);
    // if (!groupCat) return;

    // const arr: Set<ApiSticker> = new Set();

    // for (const em of groupCat?.emoticons) {
    //   for (const e of textToEmojiMap.get(em) ?? []) {
    //     arr.add(e);
    //   }
    // }

    // setEmojisCategoryFound([...arr.values()]);
  });

  const handleSearchMoreGifs = useLastCallback(() => {
    searchMoreGifs({ tabId: -1 });
  });

  const lang = useLang();

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  const results = gifSearch.query ? gifSearch.results : savedGifs;
  function renderContent() {
    if (!results) {
      return (
        <Loading />
      );
    }

    if (!results.length) {
      return (
        <p className="helper-text" dir="auto">{lang('NoGIFsFound')}</p>
      );
    }

    return results.map((gif) => (
      <GifButton
        key={gif.id}
        gif={gif}
        observeIntersection={observeIntersection}
        isDisabled={!loadAndPlay}
        onClick={canSendGifs ? onGifSelect : undefined}
        onUnsaveClick={handleUnsaveClick}
        isSavedMessages={isSavedMessages}
      />
    ));
  }

  return (
    <div className="GifPickerWithSearch">
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
      <InfiniteScroll
        ref={containerRef}
        className={buildClassName(
          'GifPicker',
          className,
          IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
        )}
        items={results}
        itemSelector=".GifButton"
        preloadBackwards={PRELOAD_BACKWARDS}
        noFastList
        onLoadMore={handleSearchMoreGifs}
      >
        {!canSendGifs ? (
          <div className="picker-disabled">
            Sending GIFs is not allowed in this chat.
          </div>
        ) : canRenderContents ? (
          renderContent()
        ) : (
          <Loading />
        )}
      </InfiniteScroll>
    </div>
  );
};

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);
    return {
      savedGifs: global.gifs.saved.gifs,
      isSavedMessages,
      gifSearch: global.gifSearch,
    };
  })(GifPicker),
);
