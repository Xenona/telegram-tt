export type AnimBgColor = [number, number, number, number];
export type AnimBgColorPoints = [
  AnimBgColor,
  AnimBgColor,
  AnimBgColor,
  AnimBgColor
];

type GLColorPoint = {
  colorLoc: WebGLUniformLocation;
  posLoc: WebGLUniformLocation;
  prevPosLoc: WebGLUniformLocation;
};

type GLState = {
  prog: WebGLProgram;
  posBuf: WebGLBuffer;
  resolutionLoc: WebGLUniformLocation;
  colorPoints: GLColorPoint[];
  transitionFactorLoc: WebGLUniformLocation;
};

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
 gl_Position = vec4(a_position, 1, 1);
}`;

const FRAGMENT_SHADER = `
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

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error("Failed to compile shader: " + gl.getShaderInfoLog(shader));
  }
  return shader;
}

const keyPoints: [number, number][] = [
  [0.265, 0.582], //0
  [0.176, 0.918], //1
  [1 - 0.585, 1 - 0.164], //0
  [0.644, 0.755], //1
  [1 - 0.265, 1 - 0.582], //0
  [1 - 0.176, 1 - 0.918], //1
  [0.585, 0.164], //0
  [1 - 0.644, 1 - 0.755], //1
];

const TRANSITION_TIME = 200;

class BaseAnimBgRender {
  protected container: HTMLDivElement | null;
  protected canvas: HTMLCanvasElement | OffscreenCanvas;
  protected shouldStop = false;
  protected resObserver: ResizeObserver | null;

  protected colors: AnimBgColorPoints;
  protected curPos: number = 0;
  protected transitionStart: number;

  constructor(
    canvas: HTMLCanvasElement | null,
    container: HTMLDivElement | null
  ) {
    if (container && canvas) {
      this.container = container;
      this.canvas = canvas;
    } else {
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
        this.canvas.width = e[0]?.contentRect?.width ?? 50;
        this.canvas.height = e[0]?.contentRect?.height ?? 50;
        this.syncState();
        this.render();
      });
      this.resObserver.observe(this.container);
    } else {
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
    console.log("XE colors")
    this.syncState();
    this.render();
  }

  transformStringsToColors(colors: {
    first?: number,
    second?: number,
    third?: number,
    fourth?: number
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
      colors.fourth & 0xff,
      (colors.fourth >> 8) & 0xff,
      (colors.fourth >> 16) & 0xff,
      0xff,
    ];


    return [fi, se, th, fo] as [AnimBgColor, AnimBgColor, AnimBgColor, AnimBgColor];
  }

  public detach() {
    this.shouldStop = true;
    this.resObserver?.disconnect();
  }

  protected render(progress?: number) {
    throw new Error("Not implemented!!");
  }

  protected getTransitionProgress(): number {
    let transitionProgress =
      (performance.now() - this.transitionStart) / TRANSITION_TIME;
    if (transitionProgress > 1) {
      transitionProgress = 1;
    }
    return transitionProgress;
  }

  protected syncState() {}

  private renderLoop() {
    if (this.shouldStop) return;

    const progress = this.getTransitionProgress();
    this.render(progress);

    if (progress == 1) return;
    requestAnimationFrame(() => this.renderLoop());
  }
}

export class AnimBgRender extends BaseAnimBgRender {
  private gl: WebGLRenderingContext | null;
  private glState: GLState | null;

  public constructor(
    canvas: HTMLCanvasElement | null,
    container: HTMLDivElement | null
  ) {
    super(canvas, container);

    // @ts-ignore
    this.gl = this.canvas.getContext("webgl");
    if (!this.gl)
      this.gl = this.canvas.getContext(
        //@ts-ignore
        "experimental-webgl"
      ) as WebGLRenderingContext;

    this.glState = null;

    try {
      this.glState = this.createGLState();
      this.syncState();
      this.render();
    } catch (e) {
      console.error("Failed to create GL state", e);
    }
  }

  public renderBitmap(
    [width, height]: [number, number],
    colors: AnimBgColorPoints,
    pos: number = 0,
    transitionProgress: number = 0
  ): ImageBitmap {
    if (!(this.canvas instanceof OffscreenCanvas))
      throw new Error("Can render bitmap only offscreen");

    this.canvas.width = width;
    this.canvas.height = height;
    this.curPos = pos;
    this.colors = colors;
    this.syncState();
    this.render(transitionProgress);
    return this.canvas.transferToImageBitmap();
  }

  private createGLState(): GLState {
    if (!this.gl) throw new Error("No GL context");
    const gl = this.gl;

    let prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(
      prog,
      compileShader(this.gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    );
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, "a_position");
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(
        [
          [-1, -1, 1, -1, -1, 1],
          [-1, 1, 1, -1, 1, 1],
        ].flat()
      ),
      gl.STATIC_DRAW
    );

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(
      posLoc,
      2, // 2 components per iteration
      gl.FLOAT, // the data is 32bit floats
      false, // don't normalize the data
      0, // 0 = move forward size * sizeof(type) each iteration to get the next position
      0 // start at the beginning of the buffer
    );

    let colorPoints: GLColorPoint[] = [];
    for (let i = 0; i < 4; i++) {
      let colorLoc = gl.getUniformLocation(prog, `colorPoints[${i}].color`)!;
      let posLoc = gl.getUniformLocation(prog, `colorPoints[${i}].pos`)!;
      let prevPosLoc = gl.getUniformLocation(
        prog,
        `colorPoints[${i}].prevPos`
      )!;
      colorPoints.push({ colorLoc, posLoc, prevPosLoc });
    }

    return {
      prog,
      posBuf,
      colorPoints,
      resolutionLoc: gl.getUniformLocation(prog, "resolution")!,
      transitionFactorLoc: gl.getUniformLocation(prog, "transitionFactor")!,
    };
  }

  protected syncState() {
    if (!this.gl || !this.glState) return;
    this.shouldStop = false;

    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform2fv(this.glState.resolutionLoc, [
      gl.canvas.width,
      gl.canvas.height,
    ]);

    for (let i = 0; i < 4; i++) {
      let { colorLoc, posLoc, prevPosLoc } = this.glState.colorPoints[i];
      let c = this.colors[i];
      gl.uniform4f(colorLoc, c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255);
      gl.uniform2f(posLoc, ...keyPoints[(this.curPos + i * 2) % 8]);
      gl.uniform2f(prevPosLoc, ...keyPoints[(this.curPos + 7 + i * 2) % 8]);
    }
  }

  protected render(progress?: number) {
    if (!this.gl || !this.glState) {
      let c = this.colors[0];
      if (this.canvas instanceof HTMLCanvasElement)
        this.canvas.style.backgroundColor = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      return;
    }

    const gl = this.gl;
    const { posBuf, transitionFactorLoc } = this.glState;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.uniform1f(
      transitionFactorLoc,
      1 - (progress ?? this.getTransitionProgress())
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

let OFFSCR_RENDERER: AnimBgRender | null = null;
let OFFSCR_RENDERER_REFCNT = 0;

export class PreviewAnimgBgRender extends BaseAnimBgRender {
  private ctx: ImageBitmapRenderingContext | null;
  private renderer: AnimBgRender;

  constructor(canvas: HTMLCanvasElement | null, container: HTMLDivElement | null) {
    super(canvas, container);

    // @ts-ignore
    this.ctx = this.canvas.getContext("bitmaprenderer");

    if (!OFFSCR_RENDERER) {
      OFFSCR_RENDERER_REFCNT = 1;
      OFFSCR_RENDERER = new AnimBgRender(null, null);
    } else {
      OFFSCR_RENDERER_REFCNT++;
    }

    this.renderer = OFFSCR_RENDERER;
  }

  public detach(): void {
    OFFSCR_RENDERER_REFCNT--;
    if (OFFSCR_RENDERER_REFCNT === 0) {
      OFFSCR_RENDERER = null;
    }

    super.detach();
  }

  protected render() {
    if (!this.ctx) return;

    let bm = this.renderer.renderBitmap(
      [this.canvas.width, this.canvas.height],
      this.colors,
      this.curPos,
      this.getTransitionProgress()
    );
    this.ctx.transferFromImageBitmap(bm);
  }
}
