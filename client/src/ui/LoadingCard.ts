/**
 * What the screen says between pressing Play and the server's `welcome` (Michael, 29 Oct: "After
 * pressing Play I sit frozen for a while and it looks as if something failed"). The hosted server
 * sleeps after 15 idle minutes and takes about a minute to wake, and nothing tells us how far along
 * it is, so the bar eases toward full over that minute rather than claiming a real percentage.
 * Nothing on it takes a press: it goes on its own when the room answers, or the party panel's
 * "Couldn't join" takes over if the server refuses or never answers.
 */

/** Not shown for a wait shorter than this, so a portal's quick hand-off never flashes it. */
const GRACE_MS = 300;
/** About how long the free server takes to wake: the bar is near full by then. */
const WAKE_MS = 60_000;

export class LoadingCard {
  private readonly root = document.createElement('div');
  private readonly title = document.createElement('div');
  private readonly note = document.createElement('div');
  private readonly fill = document.createElement('div');
  private readonly line = document.createElement('div');
  /** When the current wait began (performance.now), or null while nothing is waited for. */
  private since: number | null = null;
  visible = false;

  constructor() {
    this.root.className = 'loading-card';
    const card = document.createElement('div');
    card.className = 'loading-card-box';
    this.title.className = 'loading-card-title';
    this.note.className = 'loading-card-note';
    const bar = document.createElement('div');
    bar.className = 'loading-card-bar';
    this.fill.className = 'loading-card-fill';
    bar.appendChild(this.fill);
    this.line.className = 'loading-card-line';
    card.append(this.title, this.note, bar, this.line);
    this.root.appendChild(card);
    document.body.appendChild(this.root);
    this.root.style.display = 'none';
  }

  /**
   * Each frame: `waiting` while the title is gone and the room has not welcomed us; `first` until
   * this page has played once (after that a wait is a portal's hand-off, not the server waking);
   * `status` is the session's own line (joining, waiting for the fight).
   */
  update(waiting: boolean, first: boolean, status: string, now = performance.now()): void {
    if (!waiting) {
      this.since = null;
      this.show(false);
      return;
    }
    this.since ??= now;
    const t = now - this.since;
    if (t < GRACE_MS) return;
    this.show(true);
    this.title.textContent = first ? 'Waking the server' : 'Through the ring';
    this.note.textContent = first ? 'The server sleeps when nobody is playing. Waking it can take about a minute.' : '';
    this.fill.style.width = `${(loadingProgress(t) * 100).toFixed(1)}%`;
    this.line.textContent = `${status}  ·  ${Math.floor(t / 1000)} s`;
  }

  private show(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
  }
}

/** How full the bar is after `ms` of waiting: quick at first, 86% at a minute, never quite full. */
export function loadingProgress(ms: number): number {
  return Math.min(0.97, 1 - Math.exp((-2 * Math.max(0, ms)) / WAKE_MS));
}
