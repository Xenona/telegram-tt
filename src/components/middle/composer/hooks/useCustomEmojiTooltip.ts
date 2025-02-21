import type { RefObject } from 'react';
import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { EMOJI_IMG_REGEX } from '../../../../config';
import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import twemojiRegex from '../../../../lib/twemojiRegex';
import focusEditableElement from '../../../../util/focusEditableElement';
import { getHtmlBeforeSelection } from '../../../../util/selection';
import { IS_EMOJI_SUPPORTED } from '../../../../util/windowEnvironment';
import { buildCustomEmojiHtml } from '../helpers/customEmoji';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import { RichInputCtx } from '../../../common/richinput/useRichEditable';

const THROTTLE = 300;
const RE_ENDS_ON_EMOJI = new RegExp(`(${twemojiRegex.source})$`, 'g');

export default function useCustomEmojiTooltip(
  isEnabled: boolean,
  richInputCtx: RichInputCtx,
  customEmojis?: ApiSticker[],
) {
  const { loadCustomEmojiForEmoji, clearCustomEmojiForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractLastEmojiThrottled = useThrottledResolver(() => {
    const matchable = richInputCtx.editable.matchableS();

    if (!isEnabled || !matchable || !richInputCtx.editable.selectionS()?.collapsed) return undefined;

    const emojiMatch = matchable.match(RE_ENDS_ON_EMOJI);
    if (!emojiMatch || emojiMatch.length == 0) return undefined;

    return emojiMatch[emojiMatch.length - 1];
  }, [richInputCtx.editable.matchableS, isEnabled], THROTTLE);

  const getLastEmoji = useDerivedSignal(
    extractLastEmojiThrottled, [extractLastEmojiThrottled, richInputCtx.editable.matchableS], true,
  );

  const isActive = useDerivedState(() => Boolean(getLastEmoji()), [getLastEmoji]);
  const hasCustomEmojis = Boolean(customEmojis?.length);

  useEffect(() => {
    if (!isEnabled || !isActive) return;

    const lastEmoji = getLastEmoji();
    if (lastEmoji) {
      if (!hasCustomEmojis) {
        loadCustomEmojiForEmoji({
          emoji: lastEmoji,
        });
      }
    } else {
      clearCustomEmojiForEmoji();
    }
  }, [isEnabled, isActive, getLastEmoji, hasCustomEmojis, clearCustomEmojiForEmoji, loadCustomEmojiForEmoji]);

  const insertCustomEmoji = useLastCallback((emoji: ApiSticker) => {
    const lastEmoji = getLastEmoji();
    if (!isEnabled || !lastEmoji) return;

    const html = buildCustomEmojiHtml(emoji);
    requestNextMutation(() => {
      richInputCtx.editable.insertMatchableHtml(html, (c) => lastEmoji.indexOf(c) == -1);
    });
  });

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, richInputCtx.editable.matchableS]);

  return {
    isCustomEmojiTooltipOpen: Boolean(isActive && hasCustomEmojis && !isManuallyClosed),
    closeCustomEmojiTooltip: markManuallyClosed,
    insertCustomEmoji,
  };
}
