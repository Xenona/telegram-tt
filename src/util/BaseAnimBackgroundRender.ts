/* eslint-disable no-bitwise */
import { requestMutation } from '../lib/fasterdom/fasterdom';

export type AnimBgColor = [number, number, number, number];
export type AnimBgColorPoints = [
  AnimBgColor,
  AnimBgColor,
  AnimBgColor,
  AnimBgColor,
];

export const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
 gl_Position = vec4(a_position, 1, 1);
}`;

export const FRAGMENT_SHADER = `
precision highp float;

struct ColorPoint {
  vec4 color;
  vec2 pos;
  vec2 prevPos;
};

uniform ColorPoint colorPoints[4];
uniform vec2 resolution;
uniform float transitionFactor;

void main() {
  vec2 position = gl_FragCoord.xy / resolution.xy;

  position.y = 1.0 - position.y;

  float dp[4];
  float minD = 10000000.0;
  for(int i = 0; i < 4; i++) {
    vec2 pointPos = colorPoints[i].pos * (1.0 - transitionFactor) + colorPoints[i].prevPos * transitionFactor;
    dp[i] = distance(position, pointPos);
    minD = min(minD, dp[i]);
  }

  float p = 3.0;
  float dpt = 0.0;
  vec4 gradColor = vec4(0.0, 0.0, 0.0, 0.0);
  for(int i = 0; i < 4; i++) {
    float dpp = pow(1.0 - (dp[i] - minD), p);
    dpt += dpp;
    gradColor += colorPoints[i].color * dpp;
  }

  gradColor.w = dpt;
  gl_FragColor = gradColor / dpt;
}
`;

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Failed to compile shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

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

  return [fi, se, th, fo] as [AnimBgColor, AnimBgColor, AnimBgColor, AnimBgColor];
}

export const keyPoints: [number, number][] = [
  [0.265, 0.582], // 0
  [0.176, 0.918], // 1
  [1 - 0.585, 1 - 0.164], // 0
  [0.644, 0.755], // 1
  [1 - 0.265, 1 - 0.582], // 0
  [1 - 0.176, 1 - 0.918], // 1
  [0.585, 0.164], // 0
  [1 - 0.644, 1 - 0.755], // 1
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
    let transitionProgress = (performance.now() - this.transitionStart) / TRANSITION_TIME;
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
    requestAnimationFrame(() => this.renderLoop());
  }
}
