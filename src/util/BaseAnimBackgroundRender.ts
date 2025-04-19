/* eslint-disable no-bitwise */
import { requestMutation } from "../lib/fasterdom/fasterdom";
import { fastRaf } from "./schedulers";

export type AnimBgColor = [number, number, number, number];
export type AnimBgColorPoints = [
  AnimBgColor,
  AnimBgColor,
  AnimBgColor,
  AnimBgColor,
];

export function transformStringsToColors(colors: {
  first?: number;
  second?: number;
  third?: number;
  fourth?: number;
}): [AnimBgColor, AnimBgColor, AnimBgColor, AnimBgColor] {
  if (!colors.first) colors.first = 0xffffff;

  const fi = [
    colors.first & 0xff,
    (colors.first >> 8) & 0xff,
    (colors.first >> 16) & 0xff,
    0xff,
  ];

  if (!colors.second) colors.second = colors.first;
  const se = [
    colors.second & 0xff,
    (colors.second >> 8) & 0xff,
    (colors.second >> 16) & 0xff,
    0xff,
  ];

  if (!colors.third) colors.third = colors.second;
  const th = [
    colors.third & 0xff,
    (colors.third >> 8) & 0xff,
    (colors.third >> 16) & 0xff,
    0xff,
  ];

  if (!colors.fourth) colors.fourth = colors.third;
  const fo = [
    // eslint-disable-next-line no-bitwise
    colors.fourth & 0xff,
    // eslint-disable-next-line no-bitwise
    (colors.fourth >> 8) & 0xff,
    // eslint-disable-next-line no-bitwise
    (colors.fourth >> 16) & 0xff,
    0xff,
  ];

  return [fi, se, th, fo] as [
    AnimBgColor,
    AnimBgColor,
    AnimBgColor,
    AnimBgColor,
  ];
}

export const keyPoints: [number, number][] = [
  [0.8, 0.1],
  [0.6, 0.2],
  [0.35, 0.25],
  [0.25, 0.6],
  [0.2, 0.9],
  [0.4, 0.8],
  [0.65, 0.75],
  [0.75, 0.4],
];

const TRANSITION_TIME = 200;

export abstract class BaseAnimBgRender {
  protected container: HTMLDivElement | null;

  protected canvas: HTMLCanvasElement | OffscreenCanvas;

  protected shouldStop = false;

  protected resObserver: ResizeObserver | null;

  protected colors: AnimBgColorPoints;

  protected curPos: number = 0;

  protected transitionStart: number;

  constructor(
    canvas: HTMLCanvasElement | null,
    container: HTMLDivElement | null,
  ) {
    if (container && canvas) {
      this.container = container;
      this.canvas = canvas;
    } else {
      // eslint-disable-next-line no-null/no-null
      this.container = null;
      this.canvas = new OffscreenCanvas(50, 50);
    }

    this.colors = [
      [0xfe, 0xc4, 0x96, 0xff],
      [0xdd, 0x6c, 0xb9, 0xff],
      [0x96, 0x2f, 0xbf, 0xff],
      [0x4f, 0x5b, 0xd5, 0xff],
    ];

    if (this.container) {
      this.resObserver = new ResizeObserver((e) => {
        requestMutation(() => {
          if (e[0]?.contentRect.width == 0) return;
          this.canvas.width = e[0]?.contentRect?.width ?? 50;
          this.canvas.height = e[0]?.contentRect?.height ?? 50;
          this.syncState();
          this.render();
        });
      });
      this.resObserver.observe(this.container);
    } else {
      // eslint-disable-next-line no-null/no-null
      this.resObserver = null;
    }

    this.transitionStart = performance.now() - 2 * TRANSITION_TIME;
  }

  public nextState() {
    this.curPos = (this.curPos + 1) % 8;
    this.transitionStart = performance.now();
    this.syncState();
    this.renderLoop();
  }

  public setColors(colors: AnimBgColorPoints) {
    this.colors = colors;
    this.syncState();
    this.render();
  }

  public detach() {
    this.shouldStop = true;
    this.resObserver?.disconnect();
  }

  protected abstract render(progress?: number): void;

  protected getTransitionProgress(): number {
    let transitionProgress =
      (performance.now() - this.transitionStart) / TRANSITION_TIME;
    if (transitionProgress > 1) {
      transitionProgress = 1;
    }
    return transitionProgress;
  }

  protected abstract syncState(): void;

  private renderLoop() {
    if (this.shouldStop) return;

    const progress = this.getTransitionProgress();
    this.render(progress);

    if (progress === 1) return;
    fastRaf(() => this.renderLoop());
  }
}
