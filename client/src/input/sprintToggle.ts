import { tuning } from '@hearthgate/shared/config/tuning';

/**
 * The keyboard's sprint (Michael, 16 Nov, A): Ctrl toggles it and two quick taps of W start it, so
 * no key is ever held with W. A held Ctrl made sprinting forward Ctrl+W, which closes the tab and no
 * page can block. It ends once the keyboard has moved and then stopped for a moment (a short grace, so the
 * frame between letting go of A and pressing D does not end it). The pad keeps its held stick click.
 */
export class SprintToggle {
  on = false;
  private lastForwardMs = -Infinity;
  private stillMs = 0;
  /** Moved since it went on: Ctrl tapped while standing waits for the first step instead of ending. */
  private ran = false;
  /** A double tap seen between frames, taken by the next `step`. */
  private doubled = false;

  /**
   * W went down, stamped with the key event's own time (`KeyboardEvent.timeStamp`), not the frame's. At 5 to
   * 10 fps two taps can land inside one frame, and a frame's clock reads a 250 ms gap as anything up to two
   * frames longer, so a double tap judged per frame went missing below about 15 fps (the critic, 16 Nov).
   */
  forwardDown(atMs: number): void {
    if (atMs - this.lastForwardMs <= tuning.input.sprintDoubleTapMs) {
      this.doubled = true;
      this.lastForwardMs = -Infinity;
    } else this.lastForwardMs = atMs;
  }

  /** One frame: `toggle` is Ctrl's press, `moving` whether a move key is held. */
  step(toggle: boolean, moving: boolean, dtMs: number): boolean {
    const t = tuning.input;
    if (toggle) {
      this.on = !this.on;
      this.ran = false;
    }
    if (this.doubled) {
      this.doubled = false;
      this.on = true;
      this.ran = false;
    }
    if (moving) {
      this.stillMs = 0;
      this.ran = this.on;
    } else if (this.on && this.ran) {
      this.stillMs += dtMs;
      if (this.stillMs > t.sprintStopGraceMs) this.on = false;
    }
    return this.on;
  }

  reset(): void {
    this.on = false;
    this.stillMs = 0;
    this.ran = false;
    this.doubled = false;
    this.lastForwardMs = -Infinity;
  }
}
