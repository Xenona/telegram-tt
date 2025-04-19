/* eslint-disable no-null/no-null */
import { useEffect, useRef, useState } from '../lib/teact/teact';

import type { WallPaperPatternThemeSettings } from '../types';

import { AnimBgRender } from '../util/AnimBackgroundRender';
import { transformStringsToColors } from '../util/BaseAnimBackgroundRender';

export const usePatternBg = (fill: WallPaperPatternThemeSettings | undefined) => {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const animDivRef = useRef<HTMLDivElement>(null);

  const [renderer, setRenderer] = useState<AnimBgRender | null>(null);

  useEffect(() => {
    if (!bgRef.current || !animDivRef.current) return () => {};

    const newR = new AnimBgRender(bgRef.current, animDivRef.current);
    setRenderer(newR);
    newR.setColors(transformStringsToColors({
      first: fill?.settings.backgroundColor,
      second: fill?.settings.secondBackgroundColor,
      third: fill?.settings.thirdBackgroundColor,
      fourth: fill?.settings.fourthBackgroundColor,
    }));
    return () => newR?.detach();
  }, [bgRef, animDivRef, fill]);

  return {
    renderer,
    bgRef,
    animDivRef,
  };
};
