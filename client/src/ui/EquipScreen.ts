import { STYLES, type Style } from '@hearthgate/shared/config/tuning';
import type { Profile } from '../game/Profile';
import {
  GEAR_SLOTS,
  LEVEL_UNLOCKS,
  PERK_TEXT,
  SLOT_LABELS,
  levelFor,
  levelProgress,
  maxLevel,
  statText,
  type Item,
} from '@hearthgate/shared/sim/gear';
import { TALENT_IDS, maxRanks, talentName, talentText, type TalentId } from '@hearthgate/shared/sim/talents';

const HERO_NAMES: Record<Style, string> = { sword: 'Knight', bow: 'Archer', staff: 'Mage' };

function itemHtml(item: Item): string {
  const perk = item.perk ? `<div class="item-perk">${PERK_TEXT[item.perk]}</div>` : '';
  return `<div class="item-name ${item.rarity}">${item.name}</div><div class="item-stat">${statText(item.stat, item.slot)}</div>${perk}`;
}

/**
 * The between-runs screen (brief: "one equip screen between runs"): each
 * hero's level and what's next, the equipped slots, and everything found.
 * Mouse-driven for now.
 */
export class EquipScreen {
  private root = document.createElement('div');
  private body = document.createElement('div');
  private tab: 'gear' | 'talents' = 'gear';
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
    head.innerHTML = '<h2>Heroes</h2><span>I or Esc to close</span>';
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

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    const { action, uid, slot, style, talent } = el.dataset;
    if (action === 'equip' && uid) this.profile.equip(uid);
    if (action === 'unequip' && slot) this.profile.unequip(slot as Item['slot']);
    if (action === 'tab') this.tab = el.dataset.tab === 'talents' ? 'talents' : 'gear';
    if (action === 'rankUp' && style && talent) this.profile.changeRank(style as Style, talent as TalentId, 1);
    if (action === 'rankDown' && style && talent) this.profile.changeRank(style as Style, talent as TalentId, -1);
    if (action === 'respec' && style) this.profile.resetTalents(style as Style);
    this.onChange();
    this.render();
  }

  private render(): void {
    const d = this.profile.data;
    const heroes = STYLES.map((s) => {
      const xp = Math.floor(d.xp[s]);
      const level = levelFor(xp);
      const next = level < maxLevel() ? `Next: ${LEVEL_UNLOCKS[level + 1] ?? 'talent point'}` : 'Max level';
      const points = this.profile.pointsLeft(s);
      const unlocked = Object.entries(LEVEL_UNLOCKS)
        .filter(([l]) => Number(l) <= level)
        .map(([, text]) => `<li>${text}</li>`)
        .join('');
      return `<div class="equip-hero">
        <div class="hero-name">${HERO_NAMES[s]} <span>Lv ${level}</span></div>
        <div class="hero-xp"><div style="width:${Math.round(levelProgress(xp) * 100)}%"></div></div>
        <div class="hero-next">${next}</div>
        ${points > 0 ? `<div class="hero-points">${points} talent point${points > 1 ? 's' : ''} to spend</div>` : ''}
        <ul>${unlocked || '<li class="muted">Nothing unlocked yet</li>'}</ul>
      </div>`;
    }).join('');

    const slots = GEAR_SLOTS.map((slot) => {
      const item = this.profile.item(d.equipped[slot]);
      return `<div class="equip-slot">
        <div class="slot-label">${SLOT_LABELS[slot]}</div>
        <div class="slot-item">${item ? itemHtml(item) : '<div class="muted">Empty</div>'}</div>
        ${item ? `<button data-action="unequip" data-slot="${slot}">Unequip</button>` : ''}
      </div>`;
    }).join('');

    const equippedUids = new Set(Object.values(d.equipped));
    const items = [...d.inventory].reverse();
    const inventory = items.length
      ? items
          .map(
            (item) => `<div class="inv-item ${equippedUids.has(item.uid) ? 'equipped' : ''}">
              <div class="inv-slot">${SLOT_LABELS[item.slot]}</div>
              ${itemHtml(item)}
              ${equippedUids.has(item.uid) ? '<div class="inv-tag">Equipped</div>' : `<button data-action="equip" data-uid="${item.uid}">Equip</button>`}
            </div>`,
          )
          .join('')
      : '<div class="muted">Nothing found yet. Gear drops after waves 2 and 3, and the Warden always drops a rare.</div>';

    const unspent = STYLES.reduce((n, s) => n + this.profile.pointsLeft(s), 0);
    const tabs = `<div class="equip-tabs">
        <button data-action="tab" data-tab="gear" class="${this.tab === 'gear' ? 'on' : ''}">Gear</button>
        <button data-action="tab" data-tab="talents" class="${this.tab === 'talents' ? 'on' : ''}">Talents${unspent > 0 ? ` <b>${unspent}</b>` : ''}</button>
      </div>`;
    const gear = `<div class="equip-cols">
        <div><h3>Equipped</h3>${slots}</div>
        <div><h3>Found (${items.length})</h3><div class="inv-list">${inventory}</div></div>
      </div>`;

    this.body.innerHTML = `
      <div class="equip-heroes">${heroes}</div>
      ${tabs}
      ${this.tab === 'gear' ? gear : this.talentsHtml()}
      <div class="equip-foot">Runs ${d.runs} · Wins ${d.wins}</div>`;
  }

  /** One board per hero: a level after the first is a point; respec is free between runs. */
  private talentsHtml(): string {
    const cols = STYLES.map((s) => {
      const ranks = this.profile.data.talents[s];
      const left = this.profile.pointsLeft(s);
      const rows = TALENT_IDS.map((id) => {
        const rank = ranks[id] ?? 0;
        const max = maxRanks(id);
        const pips = Array.from({ length: max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('');
        const ability = id === 'q' || id === 'e';
        return `<div class="talent ${ability ? 'ability' : ''}">
          <div class="talent-name">${talentName(s, id)}</div>
          <div class="talent-text">${talentText(s, id)} per rank</div>
          <div class="talent-pips">${pips}</div>
          <div class="talent-btns">
            <button data-action="rankDown" data-style="${s}" data-talent="${id}" ${rank <= 0 ? 'disabled' : ''}>−</button>
            <button data-action="rankUp" data-style="${s}" data-talent="${id}" ${rank >= max || left <= 0 ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
      }).join('');
      return `<div class="talent-col">
        <div class="talent-head">${HERO_NAMES[s]} <span class="${left > 0 ? 'has' : ''}">${left} point${left === 1 ? '' : 's'}</span></div>
        ${rows}
        <button class="talent-respec" data-action="respec" data-style="${s}">Reset</button>
      </div>`;
    }).join('');
    return `<div class="talent-cols">${cols}</div>
      <div class="muted talent-note">Every level after the first gives that hero a point. Resetting is free between runs.</div>`;
  }
}
