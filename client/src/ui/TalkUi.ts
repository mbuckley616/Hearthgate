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

  /** Per frame: the villager in reach (or null) and whether talk was pressed. */
  update(near: Villager | null, pressed: boolean, dt: number): void {
    if (near && pressed) {
      this.name.textContent = near.name;
      this.line.textContent = near.line;
      this.shownFor = LINE_S;
    }
    this.shownFor = Math.max(0, this.shownFor - dt);
    this.box.style.display = this.shownFor > 0 ? 'block' : 'none';
    const hint = near && this.shownFor === 0 ? `F (or A): talk to ${near.name}` : '';
    if (hint !== this.hinted) {
      this.hinted = hint;
      this.hint.textContent = hint;
      this.hint.style.display = hint ? 'flex' : 'none';
    }
  }

  /** Leaving the village: nothing stays up. */
  clear(): void {
    this.shownFor = 0;
    this.update(null, false, 0);
  }
}
