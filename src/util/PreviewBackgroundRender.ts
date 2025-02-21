import { AnimBgRender } from './AnimBackgroundRender';
import { BaseAnimBgRender } from './BaseAnimBackgroundRender';

// eslint-disable-next-line no-null/no-null
let OFFSCR_RENDERER: AnimBgRender | null = null;
let OFFSCR_RENDERER_REFCNT = 0;

export class PreviewAnimgBgRender extends BaseAnimBgRender {
  private ctx: ImageBitmapRenderingContext | null;

  private renderer: AnimBgRender;

  // eslint-disable-next-line class-methods-use-this
  syncState() {}

  constructor(canvas: HTMLCanvasElement | null, container: HTMLDivElement | null) {
    super(canvas, container);

    // @ts-ignore
    this.ctx = this.canvas.getContext('bitmaprenderer');

    if (!OFFSCR_RENDERER) {
      OFFSCR_RENDERER_REFCNT = 1;
      // eslint-disable-next-line no-null/no-null
      OFFSCR_RENDERER = new AnimBgRender(null, null);
    } else {
      OFFSCR_RENDERER_REFCNT++;
    }

    this.renderer = OFFSCR_RENDERER;
  }

  public detach(): void {
    OFFSCR_RENDERER_REFCNT--;
    if (OFFSCR_RENDERER_REFCNT === 0) {
      // eslint-disable-next-line no-null/no-null
      OFFSCR_RENDERER = null;
    }

    super.detach();
  }

  protected render() {
    if (!this.ctx) return;

    const bm = this.renderer.renderBitmap(
      [this.canvas.width, this.canvas.height],
      this.colors,
      this.curPos,
      this.getTransitionProgress(),
    );
    this.ctx.transferFromImageBitmap(bm);
  }
}
