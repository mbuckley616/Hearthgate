import { emptyFrame, type ActionFrame, type InputSource } from './actions';

/** Merges every input source into one ActionFrame per rendered frame. */
export class InputManager {
  private sources: InputSource[] = [];

  add(source: InputSource): void {
    this.sources.push(source);
  }

  poll(dt: number): ActionFrame {
    const frame = emptyFrame();
    for (const s of this.sources) s.contribute(frame, dt);
    for (const s of this.sources) s.endFrame();
    // Several devices can push move past unit length; clamp it.
    const len = Math.hypot(frame.move.x, frame.move.y);
    if (len > 1) {
      frame.move.x /= len;
      frame.move.y /= len;
    }
    return frame;
  }
}
