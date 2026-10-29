import { stashSpaces } from '@hearthgate/shared/game/villageSave';
import { entryOf, type GearItem } from '@hearthgate/shared/sim/catalogue';
import type { ActionFrame } from '../input/actions';
import type { Profile, Space } from '../game/Profile';
import { gearIconUrl } from './gearIcons';
import { gearLine, nameOf } from './gearText';

/** The stash's width, as a bank's: wide and short, the bag beside it four across as on the hero screen. */
const STASH_COLS = 8;
const BAG_COLS = 4;

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Marta's stash (P9; Michael, 28 Oct: "closer to a RuneScape bank"). The Storehouse's spaces in a
 * wide grid, the bag beside it with its safe pocket marked (D5). Pick up and put down with F or A
 * (or a click), which swaps with what is there; X (or Q, or a shift-click) sends an item straight to
 * the other side. Esc, Tab or B puts a held item back, then leaves. The stash is the owner's, in their
 * browser with the village until Phase 3's ledger.
 */
export class BankScreen {
  private root = document.createElement('div');
  private body = document.createElement('div');
  private at: Space = { area: 'stash', i: 0 };
  private held: Space | null = null;
  private repeat = 0;
  private lastDir = '';
  private note = '';
  visible = false;

  constructor(private profile: Profile) {
    this.root.className = 'equip bank';
    const card = document.createElement('div');
    card.className = 'equip-card';
    const head = document.createElement('div');
    head.className = 'equip-head';
    head.innerHTML = '<h2>Marta’s Storehouse</h2><span>Esc, Tab or B to leave</span>';
    card.append(head, this.body);
    this.root.appendChild(card);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onClick(e, true);
    });
    document.body.appendChild(this.root);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
    if (v) {
      this.held = null;
      this.note = '';
      this.render();
    }
  }

  /** Esc, Tab or B: a held item goes back where it was first; true when the screen should close. */
  back(): boolean {
    if (this.held) {
      this.held = null;
      this.render();
      return false;
    }
    return true;
  }

  handle(actions: ActionFrame, dt: number): void {
    if (!this.visible) return;
    const x = actions.move.x + (Math.abs(actions.look.x) > 0.001 ? Math.sign(actions.look.x) : 0);
    const y = actions.move.y + (Math.abs(actions.look.y) > 0.001 ? Math.sign(actions.look.y) : 0);
    const dir = Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : Math.abs(y) > 0.5 ? (y > 0 ? 'up' : 'down') : '';
    if (dir && (dir !== this.lastDir || this.repeat <= 0)) {
      this.step(dir);
      this.render();
      this.repeat = dir === this.lastDir ? 0.12 : 0.35;
    }
    this.repeat -= dt;
    this.lastDir = dir;
    if (actions.pressed.has('interact')) this.pickOrPut();
    else if (actions.pressed.has('attack') || actions.pressed.has('ability1')) this.quick();
  }

  private size(area: Space['area']): number {
    return area === 'bag' ? this.profile.data.bag.length : this.profile.stash().length;
  }

  private cols(area: Space['area']): number {
    return area === 'bag' ? BAG_COLS : STASH_COLS;
  }

  /** Move the cursor; right off the stash's edge is the bag, left off the bag's is the stash. */
  private step(dir: string): void {
    const { area, i } = this.at;
    const cols = this.cols(area);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const n = this.size(area);
    if (dir === 'up' && row > 0) this.at = { area, i: i - cols };
    else if (dir === 'down' && i + cols < n) this.at = { area, i: i + cols };
    else if (dir === 'left' && col > 0) this.at = { area, i: i - 1 };
    else if (dir === 'right' && col < cols - 1 && i + 1 < n) this.at = { area, i: i + 1 };
    else if (dir === 'right' && area === 'stash') this.at = { area: 'bag', i: Math.min(this.size('bag') - BAG_COLS, row * BAG_COLS) };
    else if (dir === 'left' && area === 'bag') this.at = { area: 'stash', i: Math.min(this.size('stash') - 1, row * STASH_COLS + STASH_COLS - 1) };
  }

  /** F or A: pick up what is here, or put the held item down here (swapping with what is there). */
  private pickOrPut(): void {
    if (!this.held) {
      if (this.profile.itemIn(this.at)) this.held = { ...this.at };
    } else {
      if (this.held.area !== this.at.area || this.held.i !== this.at.i) this.profile.swap(this.held, this.at);
      this.held = null;
    }
    this.note = '';
    this.render();
  }

  /** X (or Q): straight to the first free space on the other side. */
  private quick(): void {
    this.held = null;
    const item = this.profile.itemIn(this.at);
    if (!item) return;
    if (!this.profile.quickMove(this.at)) this.note = this.at.area === 'bag' ? 'The stash is full: Marta needs a bigger storehouse.' : 'Your bag is full.';
    else this.note = '';
    this.render();
  }

  private onClick(e: MouseEvent, quick = false): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-area]');
    if (!el) return;
    this.at = { area: el.dataset.area as Space['area'], i: Number(el.dataset.i) };
    if (quick || e.shiftKey) this.quick();
    else this.pickOrPut();
  }

  private cellHtml(item: GearItem | null, area: Space['area'], i: number, pocket: boolean): string {
    const chosen = this.at.area === area && this.at.i === i ? ' chosen' : '';
    const held = this.held && this.held.area === area && this.held.i === i ? ' held' : '';
    const lock = pocket ? ' pocket' : '';
    const label = pocket ? '<span class="gear-slot">pocket</span>' : '';
    if (!item) return `<button class="gear-cell empty${lock}${chosen}" data-area="${area}" data-i="${i}">${label}</button>`;
    const e = entryOf(item);
    const icon = gearIconUrl(e);
    const picture = icon
      ? `<img class="pixel-art gear-icon" src="${icon}" alt="">`
      : `<span class="gear-swatch" style="background:linear-gradient(135deg, ${hex(e.material.colors.base)} 55%, ${hex(e.material.colors.trim)})"></span>`;
    return `<button class="gear-cell ${item.rarity}${lock}${chosen}${held}" data-area="${area}" data-i="${i}" title="${nameOf(item)}">${picture}<span class="gear-short">${e.shape.name}</span></button>`;
  }

  private render(): void {
    const stash = this.profile.stash();
    const used = stash.filter(Boolean).length;
    const room = stashSpaces(this.profile.village.tiers.storehouse);
    const pocket = this.profile.pocketSize();
    const stashCells = stash.map((it, i) => this.cellHtml(it, 'stash', i, false)).join('');
    const bagCells = this.profile.data.bag.map((it, i) => this.cellHtml(it, 'bag', i, i < pocket)).join('');
    const shown = this.profile.itemIn(this.held ?? this.at);
    const detail = shown
      ? `<div class="item-name ${shown.rarity}">${nameOf(shown)}${this.held ? ' <span class="muted">(held: put it down with F or A)</span>' : ''}</div><div class="muted">${gearLine(shown)}</div>`
      : '<div class="muted">An empty space.</div>';
    this.body.innerHTML = `
      <div class="bank-cols">
        <section><h3>The stash <span class="muted">${used} of ${room}</span></h3><div class="bank-grid stash-grid">${stashCells}</div></section>
        <section><h3>Your bag <span class="muted">pocket: the first ${pocket}</span></h3><div class="bank-grid bag-grid">${bagCells}</div></section>
      </div>
      <div class="bank-detail">${detail}</div>
      <div class="store-note">${this.note}</div>
      <div class="muted talent-note">Move to choose · F or A: pick up, put down · X or Q: send straight across · on a run a wipe takes the bag, all but its pocket; the stash and what you wear are safe</div>`;
  }
}
