import { getGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { RichEditable } from './RichEditable';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { ensureRLottie } from '../../../lib/rlottie/RLottie.async';
import { selectIsAlwaysHighPriorityEmoji } from '../../../global/selectors';
import AbsoluteVideo from '../../../util/AbsoluteVideo';
import { getCustomEmojiMediaDataForInput } from '../../../util/emoji/customEmojiManager';
import { round } from '../../../util/math';
import { hexToRgb } from '../../../util/switchTheme';
import { REM } from '../helpers/mediaDimensions';

import {
  addColorFilter,
  removeColorFilter,
} from '../../../hooks/stickers/useColorFilter';
import { addBackgroundModeListener } from '../../../hooks/window/useBackgroundMode';
import { addDevicePixelRatioListener } from '../../../hooks/window/useDevicePixelRatio';

const SIZE = 1.25 * REM;

type CustomEmojiPlayer = {
  play: () => void;
  pause: () => void;
  destroy: () => void;
  updatePosition: (x: number, y: number) => void;
};

let prefixCounter = 0;

export class EditableEmojiRender {
  editable: RichEditable;

  prefixId: string;

  playersById: Map<string, CustomEmojiPlayer>;

  customColor: string;

  customColorFilter: string;

  sharedCanvas: HTMLCanvasElement;

  sharedCanvasHq: HTMLCanvasElement;

  absoluteContainer: HTMLDivElement;

  resizeObserver: ResizeObserver;

  detachCbs: (() => void)[];

  canPlayAnimatedEmojis: boolean;

  constructor(editable: RichEditable) {
    this.editable = editable;
    this.playersById = new Map();
    this.prefixId = `EditableEmojiRender_${prefixCounter++}_`;
    this.customColor = '';
    this.customColorFilter = '';
    // const customColor = useDynamicColorListener(inputRef, !isReady);
    // const colorFilter = useColorFilter(customColor, true);
    // const dpr = useDevicePixelRatio();
    // const playersById = useRef<Map<string, CustomEmojiPlayer>>(new Map());
    this.sharedCanvas = document.createElement('canvas');
    this.sharedCanvas.className = 'shared-canvas';
    this.sharedCanvasHq = document.createElement('canvas');
    this.sharedCanvasHq.className = 'shared-canvas';
    this.absoluteContainer = document.createElement('div');
    this.absoluteContainer.className = 'shared-canvas';

    this.canPlayAnimatedEmojis = true;
    this.detachCbs = [];

    let throttleId: ReturnType<typeof setTimeout> | undefined;
    this.resizeObserver = new ResizeObserver(() => {
      if (throttleId !== undefined) return;
      throttleId = setTimeout(() => {
        this.synchronizeElements();
      }, 300);
    });
  }

  setCustomColor(newColor: string) {
    if (this.customColor === newColor) return;

    if (this.customColor) removeColorFilter(this.customColor);
    this.customColor = newColor;

    if (!newColor) return;
    this.customColorFilter = addColorFilter(newColor);
    this.synchronizeElements();
    document.documentElement.style.setProperty(
      '--input-custom-emoji-filter',
      this.customColorFilter || 'none',
    );
  }

  private clearPlayers(ids: string[]) {
    ids.forEach((id) => {
      const player = this.playersById.get(id);
      if (player) {
        player.destroy();
        this.playersById.delete(id);
      }
    });
  }

  synchronizeElements() {
    const global = getGlobal();
    const playerIdsToClear = new Set(this.playersById.keys());
    const customEmojis = Array.from(
      this.editable.root.querySelectorAll<HTMLElement>('.custom-emoji'),
    );

    customEmojis.forEach((element) => {
      if (!element.dataset.uniqueId) {
        return;
      }
      const playerId = `${this.prefixId}${element.dataset.uniqueId}${
        this.customColor || ''
      }`;
      const documentId = element.dataset.documentId!;

      playerIdsToClear.delete(playerId);

      const mediaUrl = getCustomEmojiMediaDataForInput(documentId);
      if (!mediaUrl) {
        return;
      }

      const canvasBounds = this.sharedCanvas.getBoundingClientRect();
      const elementBounds = element.getBoundingClientRect();
      const x = round(
        (elementBounds.left - canvasBounds.left) / canvasBounds.width,
        4,
      );
      const y = round(
        (elementBounds.top - canvasBounds.top) / canvasBounds.height,
        4,
      );

      if (this.playersById.has(playerId)) {
        const player = this.playersById.get(playerId)!;
        player.updatePosition(x, y);
        return;
      }

      const customEmoji = global.customEmojis.byId[documentId];
      if (!customEmoji) {
        return;
      }
      const isHq = customEmoji?.stickerSetInfo
        && selectIsAlwaysHighPriorityEmoji(global, customEmoji.stickerSetInfo);
      const renderId = [
        this.prefixId,
        documentId,
        this.customColor,
        window.devicePixelRatio,
      ]
        .filter(Boolean)
        .join('_');

      createPlayer({
        customEmoji,
        sharedCanvas: this.sharedCanvas,
        sharedCanvasHq: this.sharedCanvasHq,
        absoluteContainer: this.absoluteContainer,
        renderId,
        viewId: playerId,
        mediaUrl,
        isHq,
        position: { x, y },
        textColor: this.customColor,
        colorFilter: this.customColorFilter,
      }).then((animation) => {
        if (this.canPlayAnimatedEmojis) {
          animation.play();
        }

        this.playersById.set(playerId, animation);
      });
    });

    this.clearPlayers(Array.from(playerIdsToClear));
  }

  attachTo(container: HTMLElement) {
    container.appendChild(this.sharedCanvas);
    container.appendChild(this.sharedCanvasHq);
    container.appendChild(this.absoluteContainer);

    this.resizeObserver.observe(this.sharedCanvas);
    this.detachCbs.push(() => this.resizeObserver.unobserve(this.sharedCanvas));

    const removeDprListener = addDevicePixelRatioListener(() => {
      this.synchronizeElements();
    });
    this.detachCbs.push(removeDprListener);

    const removeBgListener = addBackgroundModeListener(
      () => this.freezeAnimation(),
      () => requestMutation(() => this.unfreezeAnimation()),
    );
    this.detachCbs.push(removeBgListener);

    this.synchronizeElements();
  }

  detachFrom(container: HTMLElement) {
    while (this.detachCbs.length) {
      const cb = this.detachCbs.pop();
      if (cb) cb();
    }

    this.clearPlayers(Array.from(this.playersById.keys()));
    this.resizeObserver.unobserve(this.sharedCanvas);
    container.removeChild(this.sharedCanvas);
    container.removeChild(this.sharedCanvasHq);
    container.removeChild(this.absoluteContainer);
  }

  private freezeAnimation() {
    this.playersById.forEach((player) => {
      player.pause();
    });
  }

  private unfreezeAnimation() {
    if (!this.canPlayAnimatedEmojis) {
      return;
    }

    this.playersById.forEach((player) => {
      player.play();
    });
  }
}

async function createPlayer({
  customEmoji,
  sharedCanvas,
  sharedCanvasHq,
  absoluteContainer,
  renderId,
  viewId,
  mediaUrl,
  position,
  isHq,
  textColor,
  colorFilter,
}: {
  customEmoji: ApiSticker;
  sharedCanvas: HTMLCanvasElement;
  sharedCanvasHq: HTMLCanvasElement;
  absoluteContainer: HTMLElement;
  renderId: string;
  viewId: string;
  mediaUrl: string;
  position: { x: number; y: number };
  isHq?: boolean;
  textColor?: string;
  colorFilter?: string;
}): Promise<CustomEmojiPlayer> {
  if (customEmoji.isLottie) {
    const color = customEmoji.shouldUseTextColor && textColor
      ? hexToRgb(textColor)
      : undefined;
    const RLottie = await ensureRLottie();
    const lottie = RLottie.init(
      mediaUrl,
      isHq ? sharedCanvasHq : sharedCanvas,
      renderId,
      {
        size: SIZE,
        coords: position,
        isLowPriority: !isHq,
      },
      viewId,
      color ? [color.r, color.g, color.b] : undefined,
    );

    return {
      play: () => lottie.play(),
      pause: () => lottie.pause(),
      destroy: () => lottie.removeView(viewId),
      updatePosition: (x: number, y: number) => {
        return lottie.setSharedCanvasCoords(viewId, { x, y });
      },
    };
  }

  if (customEmoji.isVideo) {
    const style = customEmoji.shouldUseTextColor && colorFilter
      ? `filter: ${colorFilter};`
      : undefined;
    const absoluteVideo = new AbsoluteVideo(mediaUrl, absoluteContainer, {
      size: SIZE,
      position,
      style,
    });
    return {
      play: () => absoluteVideo.play(),
      pause: () => absoluteVideo.pause(),
      destroy: () => absoluteVideo.destroy(),
      updatePosition: (x: number, y: number) => absoluteVideo.updatePosition({ x, y }),
    };
  }

  throw new Error('Unsupported custom emoji type');
}
