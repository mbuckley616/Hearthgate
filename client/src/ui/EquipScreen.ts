import { STYLES, tuning, type Style } from '@hearthgate/shared/config/tuning';
import { BODY_SLOTS, BODY_SLOT_NAMES, STYLE_KIND, entryOf, type BodySlot, type GearItem } from '@hearthgate/shared/sim/catalogue';
import { levelUnlock, levelFor, levelProgress, maxLevel } from '@hearthgate/shared/sim/gear';
import { TALENT_IDS, maxRanks, talentLevel, talentName, talentText, type TalentId } from '@hearthgate/shared/sim/talents';
import { CONSTELLATIONS, championMaxRanks, championName, championOpen, championPointsEarned, championText, championXpFor, type ChampionId } from '@hearthgate/shared/sim/champion';
import type { ActionFrame } from '../input/actions';
import type { Profile } from '../game/Profile';
import { gearLine, nameOf } from './gearText';

/** The weapon kinds, by the style each fights with (one hero, any weapon: T5). */
const STYLE_NAMES: Record<Style, string> = { sword: 'Sword', bow: 'Bow', staff: 'Staff' };
type Tab = 'gear' | 'talents' | 'champion';
/** Where each worn slot sits on the silhouette (column, row), as RuneScape lays out its body. */
const BODY_AT: Record<BodySlot, [number, number]> = {
  head: [1, 0],
  cape: [0, 1],
  neck: [1, 1],
  weapon: [0, 2],
  body: [1, 2],
  shield: [2, 2],
  legs: [1, 3],
  hands: [0, 4],
  feet: [1, 4],
  ring: [2, 4],
};
/** The bag is four across, seven down, to the right of the body. */
const BAG_COLS = 4;
const BAG_LEFT = 4;

/** A place the cursor can be: a worn slot or a bag space. */
type Cell = { area: 'worn'; slot: BodySlot; col: number; row: number } | { area: 'bag'; space: number; col: number; row: number };

function cells(): Cell[] {
  const out: Cell[] = BODY_SLOTS.map((slot) => ({ area: 'worn' as const, slot, col: BODY_AT[slot][0], row: BODY_AT[slot][1] }));
  for (let i = 0; i < 28; i++) out.push({ area: 'bag', space: i, col: BAG_LEFT + (i % BAG_COLS), row: Math.floor(i / BAG_COLS) });
  return out;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * The bag and the body (T5b; decisions.md 27 Oct): what the hero wears on RuneScape's ten slots, the
 * 28-space bag, and what the chosen item does; the levels each weapon kind has earned; the talent
 * boards. Keyboard and pad first (rule 4): move (WASD, the arrows or the stick) to choose, F or A to
 * wear or take off, Q or LB to drop, 1 and 2 (or the d-pad) for the tabs. Clicking works too. Open
 * between fights (I, or View on a pad), on a floor between rooms as well.
 */
export class EquipScreen {
  private root = document.createElement('div');
  private body = document.createElement('div');
  private tab: Tab = 'gear';
  /** The talent board's cursor: a weapon kind's column and a talent in it. */
  private tCol = 0;
  private tRow = 0;
  /** The champion board's cursor: a constellation and a perk in it. */
  private cCol = 0;
  private cRow = 0;
  private readonly grid = cells();
  private cursor = 0;
  /** Seconds until a held direction moves the cursor again. */
  private repeat = 0;
  private lastDir = '';
  visible = false;

  constructor(
    private profile: Profile,
    private onChange: () => void,
  ) {
    this.root.className = 'equip';
    const card = document.createElement('div');
    card.className = 'equip-card';
    const head = document.createElement('div');
    head.className = 'equip-head';
    head.innerHTML = '<h2>Your hero</h2><span>I, Esc or View to close</span>';
    card.append(head, this.body);
    this.root.appendChild(card);
    this.root.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.root);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
    if (v) this.render();
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  /**
   * Keys and pad while the screen is up (Game hands it the frame's actions and keeps the hero
   * still): move to choose, interact to wear or take off, ability 1 to drop, the style keys for tabs.
   * On the talents: move to choose, interact adds a rank, ability 1 takes one off, ability 2 resets the board.
   */
  handle(actions: ActionFrame, dt: number): void {
    if (!this.visible) return;
    if (actions.pressed.has('style1')) this.setTab('gear');
    if (actions.pressed.has('style2')) this.setTab('talents');
    if (actions.pressed.has('style3')) this.setTab('champion');
    const x = actions.move.x + (Math.abs(actions.look.x) > 0.001 ? Math.sign(actions.look.x) : 0);
    const y = actions.move.y + (Math.abs(actions.look.y) > 0.001 ? Math.sign(actions.look.y) : 0);
    const dir = Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : Math.abs(y) > 0.5 ? (y > 0 ? 'up' : 'down') : '';
    if (dir && (dir !== this.lastDir || this.repeat <= 0)) {
      if (this.tab === 'gear') this.step(dir);
      else if (this.tab === 'talents') this.stepTalent(dir);
      else this.stepChampion(dir);
      this.repeat = dir === this.lastDir ? 0.12 : 0.35;
    }
    this.repeat -= dt;
    this.lastDir = dir;
    if (this.tab === 'talents') {
      const style = STYLES[this.tCol];
      const id = TALENT_IDS[this.tRow];
      if (actions.pressed.has('interact')) this.profile.changeRank(style, id, 1);
      else if (actions.pressed.has('ability1')) this.profile.changeRank(style, id, -1);
      else if (actions.pressed.has('ability2')) this.profile.resetTalents(style);
      else return;
      this.onChange();
      this.render();
      return;
    }
    if (this.tab === 'champion') {
      const id = CONSTELLATIONS[this.cCol].perks[this.cRow];
      if (actions.pressed.has('interact')) this.profile.changeChampion(id, 1);
      else if (actions.pressed.has('ability1')) this.profile.changeChampion(id, -1);
      else if (actions.pressed.has('ability2')) this.profile.resetChampion();
      else return;
      this.onChange();
      this.render();
      return;
    }
    if (actions.pressed.has('interact')) this.use(this.grid[this.cursor]);
    if (actions.pressed.has('ability1')) this.drop(this.grid[this.cursor]);
  }

  private stepChampion(dir: string): void {
    const n = CONSTELLATIONS.length;
    if (dir === 'left' || dir === 'right') this.cCol = (this.cCol + (dir === 'right' ? 1 : n - 1)) % n;
    else this.cRow += dir === 'down' ? 1 : -1;
    this.cRow = Math.max(0, Math.min(CONSTELLATIONS[this.cCol].perks.length - 1, this.cRow));
    this.render();
  }

  private stepTalent(dir: string): void {
    if (dir === 'left' || dir === 'right') this.tCol = (this.tCol + (dir === 'right' ? 1 : STYLES.length - 1)) % STYLES.length;
    else this.tRow = Math.max(0, Math.min(TALENT_IDS.length - 1, this.tRow + (dir === 'down' ? 1 : -1)));
    this.render();
    this.body.querySelector('.talent.chosen')?.scrollIntoView({ block: 'nearest' });
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.render();
  }

  /** Move the cursor to the nearest cell that way. */
  private step(dir: string): void {
    const at = this.grid[this.cursor];
    const [dx, dy] = dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'up' ? [0, -1] : [0, 1];
    let best = -1;
    let bestScore = Infinity;
    this.grid.forEach((c, i) => {
      const ox = c.col - at.col;
      const oy = c.row - at.row;
      const along = ox * dx + oy * dy;
      if (along <= 0) return;
      const score = along + Math.abs(dx ? oy : ox) * 2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0) {
      this.cursor = best;
      this.render();
    }
  }

  private use(c: Cell): void {
    if (c.area === 'bag') this.profile.wear(c.space);
    else this.profile.takeOff(c.slot);
    this.onChange();
    this.render();
  }

  private drop(c: Cell): void {
    if (c.area !== 'bag' || !this.profile.data.bag[c.space]) return;
    this.profile.drop(c.space);
    this.render();
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    const { action, cell, style, talent } = el.dataset;
    if (action === 'cell' && cell !== undefined) {
      const i = Number(cell);
      if (i === this.cursor) this.use(this.grid[i]);
      this.cursor = i;
    }
    if (action === 'drop') this.drop(this.grid[this.cursor]);
    if (action === 'tab') this.tab = el.dataset.tab === 'talents' || el.dataset.tab === 'champion' ? el.dataset.tab : 'gear';
    if (action === 'cpUp' && talent) this.profile.changeChampion(talent as ChampionId, 1);
    if (action === 'cpDown' && talent) this.profile.changeChampion(talent as ChampionId, -1);
    if (action === 'cpReset') this.profile.resetChampion();
    if (action === 'rankUp' && style && talent) this.profile.changeRank(style as Style, talent as TalentId, 1);
    if (action === 'rankDown' && style && talent) this.profile.changeRank(style as Style, talent as TalentId, -1);
    if (action === 'respec' && style) this.profile.resetTalents(style as Style);
    this.onChange();
    this.render();
  }

  private itemAt(c: Cell): GearItem | null {
    return c.area === 'bag' ? this.profile.data.bag[c.space] : (this.profile.data.worn[c.slot] ?? null);
  }

  private render(): void {
    const d = this.profile.data;
    const levels = STYLES.map((s) => {
      const xp = Math.floor(d.xp[s]);
      const level = levelFor(xp);
      const next = level < maxLevel() ? `Next: ${levelUnlock(level + 1) ?? 'talent point'}` : 'Max level';
      const points = this.profile.pointsLeft(s);
      return `<div class="equip-hero ${this.profile.style === s ? 'in-hand' : ''}">
        <div class="hero-name">${STYLE_NAMES[s]} <span>Lv ${level}</span></div>
        <div class="hero-xp"><div style="width:${Math.round(levelProgress(xp) * 100)}%"></div></div>
        <div class="hero-next">${next}</div>
        ${points > 0 ? `<div class="hero-points">${points} talent point${points > 1 ? 's' : ''} to spend</div>` : ''}
      </div>`;
    }).join('');
    const unspent = STYLES.reduce((n, s) => n + this.profile.pointsLeft(s), 0);
    const tabs = `<div class="equip-tabs">
        <button data-action="tab" data-tab="gear" class="${this.tab === 'gear' ? 'on' : ''}">1 · Bag and body</button>
        <button data-action="tab" data-tab="talents" class="${this.tab === 'talents' ? 'on' : ''}">2 · Talents${unspent > 0 ? ` <b>${unspent}</b>` : ''}</button>
        <button data-action="tab" data-tab="champion" class="${this.tab === 'champion' ? 'on' : ''}">3 · Champion${this.profile.championLeft() > 0 ? ` <b>${this.profile.championLeft()}</b>` : ''}</button>
      </div>`;
    this.body.innerHTML = `
      <div class="equip-heroes">${levels}</div>
      ${tabs}
      ${this.tab === 'gear' ? this.gearHtml() : this.tab === 'talents' ? this.talentsHtml() : this.championHtml()}
      <div class="equip-foot">Runs ${d.runs} · Wins ${d.wins}</div>`;
  }

  private cellHtml(c: Cell, i: number): string {
    const item = this.itemAt(c);
    const label = c.area === 'worn' ? BODY_SLOT_NAMES[c.slot] : '';
    const at = `grid-column:${c.col + 1};grid-row:${c.row + 1}`;
    const chosen = i === this.cursor ? ' chosen' : '';
    if (!item) return `<button class="gear-cell empty ${c.area}${chosen}" style="${at}" data-action="cell" data-cell="${i}"><span class="gear-slot">${label}</span></button>`;
    const e = entryOf(item);
    const swatch = `background:linear-gradient(135deg, ${hex(e.material.colors.base)} 55%, ${hex(e.material.colors.trim)})`;
    return `<button class="gear-cell ${c.area} ${item.rarity}${chosen}" style="${at}" data-action="cell" data-cell="${i}" title="${nameOf(item)}">
        <span class="gear-swatch" style="${swatch}"></span><span class="gear-short">${e.shape.name}</span>${label ? `<span class="gear-slot">${label}</span>` : ''}
      </button>`;
  }

  private gearHtml(): string {
    const grid = this.grid.map((c, i) => this.cellHtml(c, i)).join('');
    const c = this.grid[this.cursor];
    const item = this.itemAt(c);
    const style = this.profile.style;
    const wrong = this.profile.mismatched();
    const penalty = wrong
      ? `<div class="gear-warn">${wrong} worn piece${wrong > 1 ? 's' : ''} not ${STYLE_KIND[style]}: -${Math.round(wrong * tuning.gear.mismatchDamagePerPiece * 100)}% damage with your ${STYLE_NAMES[style].toLowerCase()}</div>`
      : '';
    const detail = item
      ? `<div class="item-name ${item.rarity}">${nameOf(item)}</div>
         <div class="item-stat">${gearLine(item)}</div>
         <div class="gear-hint">${c.area === 'bag' ? 'F or A: wear · Q or LB: drop' : c.slot === 'weapon' ? 'Your weapon: pick another from the bag (or 1, 2, 3)' : 'F or A: take off'}</div>`
      : `<div class="muted">${c.area === 'bag' ? 'An empty space' : `Nothing on your ${BODY_SLOT_NAMES[c.slot].toLowerCase()}`}</div>`;
    const free = this.profile.data.bag.filter((i) => !i).length;
    return `<div class="gear-layout">
        <div class="gear-grid">${grid}</div>
        <div class="gear-detail">
          <h3>${c.area === 'bag' ? 'Bag' : BODY_SLOT_NAMES[c.slot]}</h3>
          ${detail}
          ${penalty}
          <div class="muted gear-free">${free} of 28 spaces free · move to choose (WASD, arrows, stick)</div>
          ${c.area === 'bag' && item ? '<button data-action="drop">Drop</button>' : ''}
        </div>
      </div>`;
  }

  /** One board per weapon kind: a level after the first is a point; respec is free between runs. */
  private talentsHtml(): string {
    const cols = STYLES.map((s, col) => {
      const ranks = this.profile.data.talents[s];
      const left = this.profile.pointsLeft(s);
      const level = levelFor(this.profile.data.xp[s]);
      const rows = TALENT_IDS.map((id, row) => {
        const rank = ranks[id] ?? 0;
        const max = maxRanks(id);
        const pips = Array.from({ length: max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('');
        const ability = id === 'q' || id === 'e';
        const opens = talentLevel(id);
        const locked = level < opens;
        const kind = `${ability ? 'ability' : ''}${opens > 1 ? ' milestone' : ''}${locked ? ' locked' : ''}${this.tab === 'talents' && col === this.tCol && row === this.tRow ? ' chosen' : ''}`;
        return `<div class="talent ${kind}">
          <div class="talent-name">${talentName(s, id)}${opens > 1 ? ` <span class="talent-level">Lv ${opens}</span>` : ''}</div>
          <div class="talent-text">${locked ? `Opens at level ${opens}: ` : ''}${talentText(s, id)} per rank</div>
          <div class="talent-pips">${pips}</div>
          <div class="talent-btns">
            <button data-action="rankDown" data-style="${s}" data-talent="${id}" ${rank <= 0 ? 'disabled' : ''}>−</button>
            <button data-action="rankUp" data-style="${s}" data-talent="${id}" ${rank >= max || left <= 0 || locked ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
      }).join('');
      return `<div class="talent-col">
        <div class="talent-head">${STYLE_NAMES[s]} <span class="${left > 0 ? 'has' : ''}">${left} point${left === 1 ? '' : 's'}</span></div>
        ${rows}
        <button class="talent-respec" data-action="respec" data-style="${s}">Reset</button>
      </div>`;
    }).join('');
    return `<div class="talent-cols">${cols}</div>
      <div class="muted talent-note">Every level after the first gives that weapon kind a point; a new row opens every ten levels. Resetting is free between fights. Move to choose · F or A: add · Q or LB: take off · E or RB: reset</div>`;
  }

  /** The three constellations (T6b): points from XP past the top level, free to move between runs until coin. */
  private championHtml(): string {
    const c = this.profile.champion;
    const earned = championPointsEarned(c.xp);
    const left = this.profile.championLeft();
    const open = championOpen(this.profile.data.xp);
    const toNext = Math.max(0, Math.ceil(championXpFor(earned + 1) - c.xp));
    const status = open
      ? `${left} of ${earned} point${earned === 1 ? '' : 's'} to spend · next in ${toNext.toLocaleString()} XP`
      : `Champion points begin when a weapon reaches level ${maxLevel()}${earned > 0 ? ` · ${left} of ${earned} to spend` : ''}`;
    const cols = CONSTELLATIONS.map((con, col) => {
      const rows = con.perks
        .map((id, row) => {
          const rank = c.ranks[id] ?? 0;
          const max = championMaxRanks(id);
          const pips = Array.from({ length: max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('');
          const chosen = this.tab === 'champion' && col === this.cCol && row === this.cRow ? ' chosen' : '';
          return `<div class="talent champion${chosen}">
          <div class="talent-name">${championName(id)}</div>
          <div class="talent-text">${championText(id)} per rank</div>
          <div class="talent-pips">${pips}</div>
          <div class="talent-btns">
            <button data-action="cpDown" data-talent="${id}" ${rank <= 0 ? 'disabled' : ''}>−</button>
            <button data-action="cpUp" data-talent="${id}" ${rank >= max || left <= 0 ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
        })
        .join('');
      return `<div class="talent-col"><div class="talent-head">${con.name}</div>${rows}</div>`;
    }).join('');
    return `<div class="champion-status ${left > 0 ? 'has' : ''}">${status}</div>
      <div class="talent-cols">${cols}</div>
      <button class="talent-respec" data-action="cpReset">Reset all</button>
      <div class="muted talent-note">Every weapon's XP past level ${maxLevel()} earns champion points, shared by all your characters. Together they add at most +${Math.round(tuning.champion.ceilingDamage * 100)}% damage and +${Math.round(tuning.champion.ceilingHealth * 100)}% health. Resetting is free between fights. Move to choose · F or A: add · Q or LB: take off · E or RB: reset</div>`;
  }
}
