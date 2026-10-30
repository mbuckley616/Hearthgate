import type { ActionFrame } from '../input/actions';

/** One of a keeper's buttons: what it does, and why it cannot be pressed now, if it cannot. */
export interface KeeperChoice {
  id: string;
  label: string;
  /** A second line under the label: a price, what a tier brings. */
  detail?: string;
  /** Shown greyed with this reason instead of acting. */
  blocked?: string;
}

/**
 * A keeper's card (P11; Michael, 29 Oct: "We need to add clear buttons/choices"): F (or A) by Wren,
 * Aldous, Marta or Fenn opens it at once, their line on top and their choices as buttons under it,
 * 48 px tall. Up and down choose, F or A takes the one chosen, Esc or B leaves; a click works too.
 * Nothing is held and nothing is timed: building a tier is one button, and the card opens on the
 * keeper's own menu, so a second F never spends anything.
 */
export class KeeperCard {
  private root = document.createElement('div');
  private name = document.createElement('div');
  private line = document.createElement('div');
  private list = document.createElement('div');
  private foot = document.createElement('div');
  private choices: KeeperChoice[] = [];
  private at = 0;
  private shown = '';
  private repeat = 0;
  private lastDir = '';
  /** The villager the card is for, by id. */
  keeper: string | null = null;
  visible = false;

  constructor(private onChoose: (id: string) => void) {
    this.root.className = 'keeper-card';
    this.name.className = 'keeper-name';
    this.line.className = 'keeper-line';
    this.list.className = 'keeper-choices';
    this.foot.className = 'keeper-foot';
    this.foot.textContent = 'Up and down to choose  ·  F or A  ·  Esc or B to leave';
    this.root.append(this.name, this.line, this.list, this.foot);
    this.list.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-at]');
      if (!el) return;
      this.at = Number(el.dataset.at);
      this.choose();
    });
    document.body.appendChild(this.root);
    this.root.style.display = 'none';
  }

  /** Open for a keeper: the first choice (their menu) is the one chosen. */
  open(keeper: string, name: string, line: string, choices: KeeperChoice[]): void {
    this.keeper = keeper;
    this.at = 0;
    this.visible = true;
    this.root.style.display = 'block';
    this.update(name, line, choices);
  }

  /** Keep the card true while it is up (a tier built, coin spent): redrawn only when something changed. */
  update(name: string, line: string, choices: KeeperChoice[]): void {
    this.choices = choices;
    this.at = Math.min(this.at, choices.length - 1);
    const key = JSON.stringify([name, line, choices, this.at]);
    if (key === this.shown) return;
    this.shown = key;
    this.name.textContent = name;
    this.line.textContent = line;
    this.list.innerHTML = choices
      .map(
        (c, i) => `<button class="keeper-choice${i === this.at ? ' chosen' : ''}${c.blocked ? ' blocked' : ''}" data-at="${i}">
          <b>${c.label}</b>${c.detail ? `<small>${c.detail}</small>` : ''}${c.blocked ? `<small class="why">${c.blocked}</small>` : ''}
        </button>`,
      )
      .join('');
  }

  close(): void {
    this.visible = false;
    this.keeper = null;
    this.shown = '';
    this.root.style.display = 'none';
  }

  handle(actions: ActionFrame, dt: number): void {
    if (!this.visible) return;
    const y = actions.move.y + (Math.abs(actions.look.y) > 0.001 ? Math.sign(actions.look.y) : 0);
    const dir = Math.abs(y) > 0.5 ? (y > 0 ? 'up' : 'down') : actions.pressed.has('zoomIn') ? 'up' : actions.pressed.has('zoomOut') ? 'down' : '';
    if (dir && (dir !== this.lastDir || this.repeat <= 0)) {
      const n = this.choices.length;
      this.at = (this.at + (dir === 'down' ? 1 : n - 1)) % n;
      this.update(this.name.textContent ?? '', this.line.textContent ?? '', this.choices);
      this.repeat = dir === this.lastDir ? 0.15 : 0.35;
    }
    this.repeat -= dt;
    this.lastDir = dir;
    if (actions.pressed.has('interact')) this.choose();
    else if (actions.pressed.has('menuBack') || actions.pressed.has('dodge')) this.onChoose('leave');
  }

  private choose(): void {
    const c = this.choices[this.at];
    if (c && !c.blocked) this.onChoose(c.id);
  }
}
