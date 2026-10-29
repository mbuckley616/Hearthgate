import type { Villager } from '@hearthgate/shared/level/village';

/** How long a villager's line stays up, seconds. */
const LINE_S = 7;

/**
 * Talking to villagers (T3): a hint when one is in reach ("F: talk to Aldous", or A on a pad), and
 * their line in a panel at the bottom of the screen once you press it. Purely the browser's: nothing
 * a villager says changes the fight, so the server is not asked.
 */
export class TalkUi {
  private hint = document.createElement('div');
  private box = document.createElement('div');
  private name = document.createElement('div');
  private line = document.createElement('div');
  private shownFor = 0;
  private hinted = '';

  constructor() {
    this.hint.className = 'talk-hint';
    this.box.className = 'talk-box';
    this.name.className = 'talk-name';
    this.line.className = 'talk-line';
    this.box.append(this.name, this.line);
    this.hint.style.display = 'none';
    this.box.style.display = 'none';
    document.body.append(this.hint, this.box);
  }

  /**
   * Per frame: the villager in reach (or null) and whether talk was pressed. `hold` adds what holding
   * talk does there (P4: build the next tier) and how far through the hold is, 0 to 1.
   */
  update(near: Villager | null, pressed: boolean, dt: number, hold: { text: string; frac: number } | null = null): void {
    if (near && pressed) {
      this.name.textContent = near.name;
      this.line.textContent = near.line;
      this.shownFor = LINE_S;
    }
    this.shownFor = Math.max(0, this.shownFor - dt);
    this.box.style.display = this.shownFor > 0 ? 'block' : 'none';
    const holding = hold && hold.frac > 0 ? `${hold.text}: ${Math.round(hold.frac * 100)}%` : '';
    const hint = !near ? '' : holding || (this.shownFor === 0 ? `F (or A): talk to ${near.name}${hold ? `  ·  hold F (or A): ${hold.text}` : ''}` : hold ? `Hold F (or A): ${hold.text}` : '');
    if (hint !== this.hinted) {
      this.hinted = hint;
      this.hint.textContent = hint;
      this.hint.style.display = hint ? 'flex' : 'none';
    }
  }

  /** Show someone's words now (Keeper Wren turning the ring, T4b). */
  say(name: string, line: string): void {
    this.name.textContent = name;
    this.line.textContent = line;
    this.shownFor = LINE_S;
    this.box.style.display = 'block';
  }

  /** Whether this villager's words are up now (a second F to Keeper Wren turns the ring). */
  showing(name: string): boolean {
    return this.shownFor > 0 && this.name.textContent === name;
  }

  /** Leaving the village: nothing stays up. */
  clear(): void {
    this.shownFor = 0;
    this.update(null, false, 0);
  }
}
