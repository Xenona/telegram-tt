import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { EMOJI_IMG_REGEX } from '../../../../config';
import twemojiRegex from '../../../../lib/twemojiRegex';
import parseEmojiOnlyString from '../../../../util/emoji/parseEmojiOnlyString';
import { IS_EMOJI_SUPPORTED } from '../../../../util/windowEnvironment';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import { RichInputCtx } from '../../../common/richinput/useRichInput';
import { IMG_ALT_MATCHABLE_MARKER } from '../../../common/richinput/RichEditable';

const MAX_LENGTH = 8;
const STARTS_ENDS_ON_EMOJI_IMG_REGEX = new RegExp(`^${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useStickerTooltip(
  isEnabled: boolean,
  richInputCtx: RichInputCtx,
  stickers?: ApiSticker[],
) {
  const { loadStickersForEmoji, clearStickersForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const getSingleEmoji = useDerivedSignal(() => {
    const matchable = richInputCtx.editable.matchableS();
    if (!isEnabled || !matchable || (IS_EMOJI_SUPPORTED && matchable.length > MAX_LENGTH)) return undefined;
    const hasEmoji = matchable.match(twemojiRegex);
    if (!hasEmoji) return undefined;

    const cleanHtml = prepareForRegExp(matchable).replace(IMG_ALT_MATCHABLE_MARKER, "");
    const isSingleEmoji = cleanHtml && parseEmojiOnlyString(cleanHtml) === 1

    return isSingleEmoji
      ? cleanHtml
      : undefined;
  }, [richInputCtx.editable.matchableS, isEnabled]);

  const isActive = useDerivedState(() => Boolean(getSingleEmoji()), [getSingleEmoji]);
  const hasStickers = Boolean(stickers?.length);

  useEffect(() => {
    if (!isEnabled || !isActive) return;

    const singleEmoji = getSingleEmoji();
    if (singleEmoji) {
      if (!hasStickers) {
        loadStickersForEmoji({ emoji: singleEmoji });
      }
    } else {
      clearStickersForEmoji();
    }
  }, [isEnabled, isActive, getSingleEmoji, hasStickers, loadStickersForEmoji, clearStickersForEmoji]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, richInputCtx.editable.htmlS]);

  return {
    isStickerTooltipOpen: Boolean(isActive && hasStickers && !isManuallyClosed),
    closeStickerTooltip: markManuallyClosed,
  };
}
