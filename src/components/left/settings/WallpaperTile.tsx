/* eslint-disable no-null/no-null */
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiWallpaper } from '../../../api/types';
import type { ThemeKey, WallPaperPatternThemeSettings } from '../../../types';
import { UPLOADING_WALLPAPER_SLUG } from '../../../types';

import { CUSTOM_BG_CACHE_NAME } from '../../../config';
import { selectCanAnimateInterface } from '../../../global/selectors';
import { transformStringsToColors } from '../../../util/BaseAnimBackgroundRender';
import buildClassName from '../../../util/buildClassName';
import * as cacheApi from '../../../util/cacheApi';
import { fetchBlob } from '../../../util/files';
import { PreviewAnimgBgRender } from '../../../util/PreviewBackgroundRender';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useCanvasBlur from '../../../hooks/useCanvasBlur';
import useMedia from '../../../hooks/useMedia';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import ProgressSpinner from '../../ui/ProgressSpinner';

import './WallpaperTile.scss';

type OwnProps = {
  wallpaper: ApiWallpaper;
  theme: ThemeKey;
  fill?: WallPaperPatternThemeSettings;
  isSelected: boolean;
  onClick: (slug?: string, settings?: WallPaperPatternThemeSettings) => void;
};

const WallpaperTile: FC<OwnProps> = ({
  wallpaper,
  theme,
  fill,
  isSelected,
  onClick,
}) => {
  const { slug, document } = wallpaper;
  const localMediaHash = `wallpaper${document?.id!}`;
  const localBlobUrl = document?.previewBlobUrl;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`);

  const thumbRef = useCanvasBlur(document?.thumbnail?.dataUri, Boolean(previewBlobUrl), true);

  const mouseRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const animDivRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<PreviewAnimgBgRender | null>(null);

  const isGradientWithoutPattern = !fill?.pattern && fill?.settings;

  useEffect(() => {
    if (bgRef.current && animDivRef.current) {
      const renderer2 = new PreviewAnimgBgRender(bgRef.current, animDivRef.current);
      setRenderer(renderer2);
      renderer2.setColors(transformStringsToColors({
        first: fill?.settings.backgroundColor,
        second: fill?.settings.secondBackgroundColor,
        third: fill?.settings.thirdBackgroundColor,
        fourth: fill?.settings.fourthBackgroundColor,
      }));
    }

    return () => renderer?.detach();
  }, [bgRef, animDivRef,
    fill?.settings.backgroundColor,
    fill?.settings.secondBackgroundColor,
    fill?.settings.thirdBackgroundColor,
    fill?.settings.fourthBackgroundColor, renderer]);

  const { transitionClassNames } = useShowTransitionDeprecated(
    Boolean(previewBlobUrl || localBlobUrl),
    undefined,
    undefined,
    'slow',
  );
  const isLoadingRef = useRef(false);
  const [isLoadAllowed, setIsLoadAllowed] = useState(false);

  const res = useMediaWithLoadProgress(localMediaHash, !isLoadAllowed || !slug);
  const fullMedia: string | undefined = res.mediaData;
  const loadProgress = res.loadProgress;

  const wasLoadDisabled = usePreviousDeprecated(isLoadAllowed) === false;
  const { shouldRender: shouldRenderSpinner, transitionClassNames: spinnerClassNames } = useShowTransitionDeprecated(
    (isLoadAllowed && !fullMedia) || slug === UPLOADING_WALLPAPER_SLUG,
    undefined,
    wasLoadDisabled,
    'slow',
  );

  // To prevent triggering of the effect for useCallback
  const cacheKeyRef = useRef<string>();
  cacheKeyRef.current = theme;

  const canAnimate = selectCanAnimateInterface(getGlobal());

  useEffect(() => {
    const handleMouse = () => {
      if (canAnimate) {
        renderer?.nextState();
      }
    };

    if (mouseRef.current && !IS_TOUCH_ENV && canAnimate) {
      mouseRef.current.addEventListener('mouseenter', handleMouse);
    }

    const mouseRefCurr = mouseRef.current;

    return () => {
      mouseRefCurr?.removeEventListener('mouseenter', handleMouse);
    };
  }, [canAnimate, mouseRef, renderer]);

  const handleSelect = useCallback(() => {
    (async () => {
      const blob = await fetchBlob(fullMedia!);
      await cacheApi.save(CUSTOM_BG_CACHE_NAME, cacheKeyRef.current!, blob);
      onClick(slug, fill);
    })();
  }, [fill, fullMedia, onClick, slug]);

  useEffect(() => {
    // If we've clicked on a wallpaper, select it when full media is loaded
    if (fullMedia && isLoadingRef.current) {
      handleSelect();
      isLoadingRef.current = false;
    }
  }, [fullMedia, handleSelect]);

  const handleClick = useCallback(() => {
    if (fullMedia || isGradientWithoutPattern) {
      handleSelect();
      if (canAnimate) {
        renderer?.nextState();
      }
    } else {
      isLoadingRef.current = true;
      setIsLoadAllowed((isAllowed) => !isAllowed);
    }
  }, [canAnimate, fullMedia, handleSelect, isGradientWithoutPattern, renderer]);

  const className = buildClassName(
    'WallpaperTile',
    isSelected && 'selected',
  );

  return (
    <div
      className={className}
      onClick={handleClick}
      ref={mouseRef}
      style={`--bg-image: url(${previewBlobUrl || localBlobUrl});`}
    >
      <div
        className="media-inner"
        ref={animDivRef}
        style={fill?.dark ? 'background: #000;' : ''}
      >
        <canvas ref={thumbRef} className="thumbnail" />
        <canvas ref={bgRef} className={buildClassName('thumbnail', fill?.dark && fill?.pattern && 'dark')} />
        {!fill?.pattern && slug && !fill?.settings && (
          <img
            src={previewBlobUrl || localBlobUrl}
            className={buildClassName('full-media', transitionClassNames)}
            alt=""
            draggable={false}
          />
        )}
        {((!fill?.pattern && !slug && fill?.settings)
          || (fill?.pattern && slug && fill?.settings)) && (
          <div
            className={buildClassName('full-media', transitionClassNames, fill?.pattern && 'with-pattern')}
            draggable={false}
          />
        )}

        {shouldRenderSpinner && (
          <div
            className={buildClassName('spinner-container', spinnerClassNames)}
          >
            <ProgressSpinner progress={loadProgress} onClick={handleClick} />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(WallpaperTile);
