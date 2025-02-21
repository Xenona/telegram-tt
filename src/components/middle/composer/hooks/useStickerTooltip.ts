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
import { RichInputCtx } from '../../../common/richinput/useRichEditable';

const MAX_LENGTH = 8;
const MAX_UNSUPPORTED_LENGTH = 160;
const STARTS_ENDS_ON_EMOJI_IMG_REGEX = new RegExp(`^${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useStickerTooltip(
  isEnabled: boolean,
  richInputCtx: RichInputCtx,
  stickers?: ApiSticker[],
) {
  const { loadStickersForEmoji, clearStickersForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const getSingleEmoji = useDerivedSignal(() => {
    const html = richInputCtx.editable.htmlS();
    if (!isEnabled || !html || (IS_EMOJI_SUPPORTED && html.length > MAX_LENGTH)) return undefined;
    if(IS_EMOJI_SUPPORTED) {
      if(html.length > MAX_LENGTH) return undefined;
    } else {
      if(html[0] != '<' && html[1] != '<' && html.length > MAX_UNSUPPORTED_LENGTH) return undefined;
    }

    const hasEmoji = html.match(IS_EMOJI_SUPPORTED ? twemojiRegex : EMOJI_IMG_REGEX);
    if (!hasEmoji) return undefined;

    const cleanHtml = prepareForRegExp(html);
    const isSingleEmoji = cleanHtml && (
      (IS_EMOJI_SUPPORTED && parseEmojiOnlyString(cleanHtml) === 1)
      || (!IS_EMOJI_SUPPORTED && Boolean(html.match(STARTS_ENDS_ON_EMOJI_IMG_REGEX)))
    );

    return isSingleEmoji
      ? (IS_EMOJI_SUPPORTED ? cleanHtml : cleanHtml.match(/alt="(.+)"/)?.[1]!)
      : undefined;
  }, [richInputCtx.editable.htmlS, isEnabled]);

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
