import type { AnimBgColorPoints } from './BaseAnimBackgroundRender';

import { requestMutation } from '../lib/fasterdom/fasterdom';

import { BaseAnimBgRender, keyPoints } from './BaseAnimBackgroundRender';

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

  float centerDistanceX = position.x - 0.5;
  float centerDistanceY = position.y - 0.5;
  float centerDistance = sqrt(centerDistanceX * centerDistanceX + centerDistanceY * centerDistanceY);
  float swirlFactor = 0.35 * centerDistance;
  float theta = swirlFactor * swirlFactor * 0.8 * 8.0;
  float sinTheta = sin(theta);
  float cosTheta = cos(theta);

  float pixelX = max(0.0, min(1.0, 0.5 + centerDistanceX * cosTheta - centerDistanceY * sinTheta));
  float pixelY = max(0.0, min(1.0, 0.5 + centerDistanceX * sinTheta + centerDistanceY * cosTheta));

  vec2 pixelPos = vec2(pixelX, 1.-pixelY);

  float p = 4.0;
  float dpt = 0.0;
  vec4 gradColor = vec4(0.0, 0.0, 0.0, 0.0);
  for(int i = 0; i < 4; i++) {
    vec2 pointPos = colorPoints[i].pos * (1.0 - transitionFactor) + colorPoints[i].prevPos * transitionFactor;
    float distance = max(0.0, 0.9 - distance(pixelPos, pointPos));
    float dpp = pow(distance, p);
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

export class AnimBgRender extends BaseAnimBgRender {
  private gl: WebGLRenderingContext | null;

  private glState: GLState | null;

  public constructor(
    canvas: HTMLCanvasElement | null,
    container: HTMLDivElement | null,
  ) {
    super(canvas, container);

    // @ts-ignore
    this.gl = this.canvas.getContext('webgl');
    if (!this.gl && this.canvas instanceof HTMLCanvasElement) {
      this.gl = this.canvas.getContext(
      // @ts-ignore
        'experimental-webgl',
      ) as WebGLRenderingContext;
    }

    // eslint-disable-next-line no-null/no-null
    this.glState = null;

    try {
      this.glState = this.createGLState();
      this.syncState();
      this.render();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to create GL state', e);
    }
  }

  public renderBitmap(
    [width, height]: [number, number],
    colors: AnimBgColorPoints,
    pos: number = 0,
    transitionProgress: number = 0,
  ): ImageBitmap | null {
    if (!(this.canvas instanceof OffscreenCanvas)) throw new Error('Can render bitmap only offscreen');
    // eslint-disable-next-line no-null/no-null
    if (!this.gl) return null;

    requestMutation(() => {
      this.canvas.width = width;
      this.canvas.height = height;
    });
    this.curPos = pos;
    this.colors = colors;
    this.syncState();
    this.render(transitionProgress);
    return this.canvas.transferToImageBitmap();
  }

  private createGLState(): GLState {
    if (!this.gl) throw new Error('No GL context');
    const gl = this.gl;

    const prog = gl.createProgram();
    if (!prog) {
      throw new Error('No WebGLProgram found');
    }

    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(
      prog,
      compileShader(this.gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER),
    );
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    const posBuf = gl.createBuffer();
    if (!posBuf) {
      throw new Error('No WebGL buffer created');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(
        [
          [-1, -1, 1, -1, -1, 1],
          [-1, 1, 1, -1, 1, 1],
        ].flat(),
      ),
      gl.STATIC_DRAW,
    );

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(
      posLoc,
      2, // 2 components per iteration
      gl.FLOAT, // the data is 32bit floats
      false, // don't normalize the data
      0, // 0 = move forward size * sizeof(type) each iteration to get the next position
      0, // start at the beginning of the buffer
    );

    const colorPoints: GLColorPoint[] = [];
    for (let i = 0; i < 4; i++) {
      const colorLoc = gl.getUniformLocation(prog, `colorPoints[${i}].color`)!;
      const posLoc2 = gl.getUniformLocation(prog, `colorPoints[${i}].pos`)!;
      const prevPosLoc = gl.getUniformLocation(
        prog,
        `colorPoints[${i}].prevPos`,
      )!;
      colorPoints.push({ colorLoc, posLoc: posLoc2, prevPosLoc });
    }

    return {
      prog,
      posBuf,
      colorPoints,
      resolutionLoc: gl.getUniformLocation(prog, 'resolution')!,
      transitionFactorLoc: gl.getUniformLocation(prog, 'transitionFactor')!,
    };
  }

  protected syncState() {
    if (!this.gl || !this.glState) return;
    this.shouldStop = false;

    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(this.glState.prog);
    gl.uniform2fv(this.glState.resolutionLoc, [
      gl.canvas.width,
      gl.canvas.height,
    ]);

    for (let i = 0; i < 4; i++) {
      const { colorLoc, posLoc, prevPosLoc } = this.glState.colorPoints[i];
      const c = this.colors[i];
      gl.uniform4f(colorLoc, c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255);
      gl.uniform2f(posLoc, ...keyPoints[(this.curPos + i * 2) % 8]);
      gl.uniform2f(prevPosLoc, ...keyPoints[(this.curPos + 7 + i * 2) % 8]);
    }
  }

  protected render(progress?: number) {
    if (!this.gl || !this.glState) {
      const c = this.colors[0];
      if (this.canvas instanceof HTMLCanvasElement) {
        this.canvas.style.backgroundColor = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      }
      return;
    }

    const gl = this.gl;
    const { posBuf, transitionFactorLoc } = this.glState;
    gl.useProgram(this.glState.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.uniform1f(
      transitionFactorLoc,
      1 - (progress ?? this.getTransitionProgress()),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
