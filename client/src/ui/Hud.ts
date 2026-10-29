import { ABILITIES, ABILITY_NAMES, OFFHAND_ABILITY, STRING_MOVES, abilityTiming, tuning, type Style } from '@hearthgate/shared/config/tuning';
import { levelUnlock, levelFor, levelProgress } from '@hearthgate/shared/sim/gear';
import { gearLine, nameOf as itemNameOf } from './gearText';
import { cooldownMult, pointsEarned, pointsSpent } from '@hearthgate/shared/sim/talents';
import { flowTier } from '@hearthgate/shared/sim/flow';
import { ICONS, iconUrl } from './pixelArt';
import type { Combo, PlayerState, SimEvent, SimState } from '@hearthgate/shared/sim/types';

const HERO_NAMES: Record<Style, string> = { sword: 'Knight', bow: 'Archer', staff: 'Mage' };
const TOAST_MS = 4200;
const COMBO_WORDS: Record<Combo, string> = { shatter: 'Shatter', skewer: 'Skewer', detonate: 'Detonate' };

/**
 * Combat HUD from the brief: the weapon in hand's level over health, dodge charges and a combo
 * counter, the ability cooldowns under them, a red edge flash when hurt and a "down" notice. The
 * other weapons' levels are on the hero screen's Talents tab (Michael, 28 Oct).
 */
export class Hud {
  private root = document.createElement('div');
  /** "Knight · Level 6" for the weapon in hand, with its progress to the next level beneath. */
  private level = document.createElement('div');
  private levelText = document.createElement('span');
  private levelXp = document.createElement('div');
  private shownLevel = '';
  private hpFill = document.createElement('div');
  /** The active hero's pixel portrait beside the health bar. */
  private portrait = document.createElement('img');
  private shownStyle: Style | null = null;
  private hpText = document.createElement('div');
  private pips = document.createElement('div');
  private combo = document.createElement('div');
  private comboCount = document.createElement('div');
  private vignette = document.createElement('div');
  private down = document.createElement('div');
  /** Revive Draughts carried on this floor (Hearthgate's downs, T5). */
  private draught = document.createElement('div');
  /** Health potions on the belt and the key that drinks one (D4). */
  private potion = document.createElement('div');
  private shownPotions = -1;
  private hits = 0;
  private sinceHit = Infinity;
  private hurtFlash = 0;
  private shownPips = -1;
  private abilityRoot = document.createElement('div');
  private toasts = document.createElement('div');
  private guardText = document.createElement('div');
  /** The Flow meter (C2), under the health bar. */
  private flow = document.createElement('div');
  private flowFill = document.createElement('div');
  private flowLabel = document.createElement('div');
  private comboText = document.createElement('div');
  private slots: { root: HTMLDivElement; name: HTMLDivElement; sweep: HTMLDivElement; time: HTMLDivElement; icon: HTMLImageElement; wasReady: boolean }[] = [];

  constructor() {
    this.root.className = 'hud';
    const hp = document.createElement('div');
    hp.className = 'hud-hp';
    this.hpFill.className = 'hud-hp-fill';
    this.hpText.className = 'hud-hp-text';
    hp.append(this.hpFill, this.hpText);
    this.pips.className = 'hud-pips';
    this.portrait.className = 'pixel-art hud-portrait';
    const bars = document.createElement('div');
    bars.className = 'hud-bars';
    this.draught.className = 'hud-draught';
    this.potion.className = 'hud-potion';
    this.flow.className = 'hud-flow';
    this.flowFill.className = 'hud-flow-fill';
    this.flowLabel.className = 'hud-flow-label';
    const ticks = '<i style="left:33.33%"></i><i style="left:66.66%"></i>';
    this.flow.innerHTML = ticks;
    this.flow.prepend(this.flowFill);
    this.flow.append(this.flowLabel);
    this.level.className = 'hud-level';
    this.levelXp.className = 'hud-level-xp';
    const xpTrack = document.createElement('div');
    xpTrack.className = 'hud-level-track';
    xpTrack.appendChild(this.levelXp);
    this.level.append(this.levelText, xpTrack);
    bars.append(this.level, hp, this.flow, this.pips, this.draught, this.potion);
    this.root.append(this.portrait, bars);

    this.combo.className = 'hud-combo';
    this.comboCount.className = 'hud-combo-count';
    const label = document.createElement('div');
    label.className = 'hud-combo-label';
    label.textContent = 'HITS';
    this.combo.append(this.comboCount, label);

    this.abilityRoot.className = 'hud-abilities';
    for (const key of ['1', '2', '3']) {
      const root = document.createElement('div');
      root.className = 'hud-ability';
      const keyEl = document.createElement('div');
      keyEl.className = 'hud-ability-key';
      keyEl.textContent = key;
      const name = document.createElement('div');
      name.className = 'hud-ability-name';
      const sweep = document.createElement('div');
      sweep.className = 'hud-ability-sweep';
      const time = document.createElement('div');
      time.className = 'hud-ability-time';
      const icon = document.createElement('img');
      icon.className = 'pixel-art hud-ability-icon';
      root.append(icon, sweep, keyEl, name, time);
      this.abilityRoot.appendChild(root);
      this.slots.push({ root, name, sweep, time, icon, wasReady: true });
    }
    document.body.appendChild(this.abilityRoot);

    this.vignette.className = 'hud-vignette';
    this.down.className = 'hud-down';
    this.toasts.className = 'hud-toasts';
    document.body.append(this.root, this.combo, this.vignette, this.down, this.toasts, this.guardText, this.comboText);
  }

  handle(events: SimEvent[], localId: string, sim: SimState): void {
    const nameOf = (id: string) => sim.players.find((p) => p.id === id)?.name || 'An ally';
    for (const ev of events) {
      // Cross-style combos: a big callout word for everyone (brief).
      if (ev.kind === 'combo') {
        const who = ev.playerId === localId ? '' : `<span>${nameOf(ev.playerId)}</span>`;
        this.comboText.innerHTML = `${COMBO_WORDS[ev.combo]}!${who}`;
        this.comboText.className = `hud-combo-call ${ev.combo}`;
        void this.comboText.offsetWidth;
        this.comboText.classList.add('show');
      }
      if (ev.kind === 'playerJoined' && ev.playerId !== localId) this.toast(`<b>${ev.name || 'A friend'} joined</b><span>Fight beside them</span>`, 'level');
      if (ev.kind === 'playerLeft' && ev.playerId !== localId) this.toast(`<b>${ev.name || 'A friend'} left</b>`, 'common');
      if (ev.kind === 'revived') {
        const with_ = ev.draught ? ' with a Revive Draught' : '';
        if (ev.playerId === localId) this.toast(`<b>${nameOf(ev.by)} revived you${with_}</b>`, 'level');
        else if (ev.by === localId) this.toast(`<b>You revived ${nameOf(ev.playerId)}${with_}</b>`, 'level');
      }
      if (ev.kind === 'bledOut' && ev.playerId !== localId) {
        this.toast(`<b>${nameOf(ev.playerId)} has bled out</b>: out until the room is cleared`, 'level');
      }
      if (ev.kind === 'hit' && ev.attackerId === localId) {
        this.hits = this.sinceHit * 1000 < tuning.combat.comboResetMs ? this.hits + 1 : 1;
        this.sinceHit = 0;
        // Restart the pop animation.
        this.comboCount.classList.remove('pop');
        void this.comboCount.offsetWidth;
        this.comboCount.classList.add('pop');
      }
      if (ev.kind === 'heroHurt' && ev.playerId === localId) this.hurtFlash = 1;
      if (ev.kind === 'parry' && ev.playerId === localId) this.guardPop('Parry', 'parry');
      // A string move (C1) names itself, so the strings can be learned by playing.
      if (ev.kind === 'stringMove' && ev.playerId === localId) {
        const style = sim.players.find((pl) => pl.id === localId)?.style;
        const name = style ? STRING_MOVES[style][ev.move] : undefined;
        if (name) this.guardPop(ev.charge >= 3 ? `${name} · Crescendo` : ev.charge >= 2 ? `${name} · charged` : name, ev.charge >= 2 ? 'heavy charged' : 'heavy');
      }
      if (ev.kind === 'block' && ev.playerId === localId && ev.broke) this.guardPop('Guard broken', 'broke');
      if (ev.kind === 'levelUp' && ev.playerId === localId) {
        const unlock = levelUnlock(ev.level) ? `${levelUnlock(ev.level)} unlocked · ` : '';
        this.toast(`<b>${HERO_NAMES[ev.style]} reached level ${ev.level}</b><span>${unlock}+1 talent point</span>`, 'level');
      }
      if (ev.kind === 'championPoint' && ev.playerId === localId) {
        this.toast(`<b>Champion point ${ev.points}</b><span>Spend it under Tab · 3 Champion</span>`, 'level');
      }
      if (ev.kind === 'pickup' && ev.playerId === localId) {
        const i = ev.item;
        const held = ev.carried ? '  ·  carried until you bank it' : '';
        this.toast(`<b class="${i.rarity}">${i.rarity === 'rare' ? 'Rare: ' : ''}${itemNameOf(i)}</b><span>${gearLine(i)}${held}</span>`, i.rarity);
      }
      if (ev.kind === 'banked' && ev.playerId === localId && (ev.items.length > 0 || ev.coin > 0)) {
        this.toast(`<b>Banked ${ev.items.length} find${ev.items.length === 1 ? '' : 's'}</b><span>+${ev.coin} coin  ·  floor ${ev.floor}</span>`, 'level');
      }
      if (ev.kind === 'potionTaken' && ev.playerId === localId) {
        this.toast(`<b class="potion">Health potion</b><span>${ev.potions} on your belt  ·  G, 4 or d-pad left to drink</span>`, 'common');
      }
      if (ev.kind === 'findsLost' && ev.playerId === localId) {
        this.toast(`<b>Lost ${ev.count} unbanked find${ev.count === 1 ? '' : 's'}</b><span>Bank them in a rest room next time</span>`, 'common');
      }
    }
  }

  update(p: PlayerState, dt: number, inRun: boolean): void {
    if (p.style !== this.shownStyle) {
      this.shownStyle = p.style;
      this.portrait.src = iconUrl(ICONS[p.style]);
    }
    // The hero's name follows the style until specializations (the builds pass) give it their own.
    const xp = p.xp[p.style];
    const unspent = pointsEarned(xp) - pointsSpent(p.talents[p.style]);
    const level = `${HERO_NAMES[p.style]} · Level ${levelFor(xp)}${unspent > 0 ? `<b>+${unspent}</b>` : ''}`;
    if (level !== this.shownLevel) {
      this.shownLevel = level;
      this.levelText.innerHTML = level;
      this.level.title = unspent > 0 ? `${unspent} talent point${unspent > 1 ? 's' : ''} to spend (Tab, between runs)` : '';
    }
    this.levelXp.style.width = `${Math.round(levelProgress(xp) * 100)}%`;
    const max = p.maxHp;
    const frac = Math.max(0, Math.min(1, p.hp / max));
    this.hpFill.style.width = `${frac * 100}%`;
    this.hpFill.classList.toggle('low', frac < 0.3);
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${max}`;
    // Flow (C2): the meter and its tier; full, it says how to spend it.
    this.flow.style.display = p.flow ? 'block' : 'none';
    if (p.flow) {
      const tier = flowTier(p);
      const full = p.flow.v >= tuning.flow.max;
      this.flowFill.style.width = `${Math.min(100, (p.flow.v / tuning.flow.max) * 100)}%`;
      this.flow.className = `hud-flow tier${tier}${full ? ' full' : ''}`;
      this.flowLabel.textContent = full ? 'Crescendo: charge a heavy' : tier > 0 ? `Flow ${['', 'I', 'II', 'III'][tier]}` : '';
    }

    if (p.dodgeCharges !== this.shownPips) {
      this.shownPips = p.dodgeCharges;
      this.pips.innerHTML = '';
      for (let i = 0; i < tuning.dodge.charges; i++) {
        const pip = document.createElement('div');
        pip.className = `hud-pip${i < p.dodgeCharges ? ' full' : ''}`;
        this.pips.appendChild(pip);
      }
    }

    this.sinceHit += dt;
    const showCombo = this.hits >= 2 && this.sinceHit * 1000 < tuning.combat.comboResetMs;
    this.combo.style.opacity = showCombo ? '1' : '0';
    if (showCombo) this.comboCount.textContent = String(this.hits);

    this.hurtFlash *= Math.exp(-5 * dt);
    this.vignette.style.opacity = String(this.hurtFlash * 0.8);

    // Ability cooldowns for the active hero: a dark sweep that empties as it recharges.
    ABILITIES[p.style].forEach((kind, i) => {
      const slot = this.slots[i];
      const left = p.cooldowns[p.style][i];
      const total = abilityTiming(kind).cooldown * cooldownMult(p);
      if (slot.name.textContent !== ABILITY_NAMES[kind]) {
        slot.name.textContent = ABILITY_NAMES[kind];
        slot.icon.src = iconUrl(ICONS[kind]);
      }
      const frac = total > 0 ? Math.min(1, left / total) : 0;
      slot.sweep.style.background = `conic-gradient(rgba(0,0,0,0.65) ${frac * 360}deg, transparent 0deg)`;
      // The second ability unlocks at level 2.
      const locked = i === 1 && levelFor(p.xp[p.style]) < 2;
      slot.root.classList.toggle('locked', locked);
      slot.time.textContent = locked ? 'Lv 2' : left > 0 ? Math.ceil(left).toString() : '';
      const ready = left <= 0 && !locked;
      slot.root.classList.toggle('ready', ready);
      if (ready && !slot.wasReady) {
        slot.root.classList.remove('flash');
        void slot.root.offsetWidth;
        slot.root.classList.add('flash');
      }
      slot.wasReady = ready;
    });
    // The off-hand's ability on 3 (C4), shown only while one is in use.
    const third = this.slots[2];
    const off = p.mods.offhand;
    third.root.style.display = off ? '' : 'none';
    if (off) {
      const kind = OFFHAND_ABILITY[off];
      if (third.name.textContent !== ABILITY_NAMES[kind]) {
        third.name.textContent = ABILITY_NAMES[kind];
        third.icon.src = iconUrl(ICONS[kind]);
      }
      const left = p.offhandCooldown ?? 0;
      const total = abilityTiming(kind).cooldown * cooldownMult(p);
      third.sweep.style.background = `conic-gradient(rgba(0,0,0,0.65) ${(total > 0 ? Math.min(1, left / total) : 0) * 360}deg, transparent 0deg)`;
      third.time.textContent = left > 0 ? Math.ceil(left).toString() : '';
      const ready = left <= 0;
      third.root.classList.toggle('ready', ready);
      if (ready && !third.wasReady) {
        third.root.classList.remove('flash');
        void third.root.offsetWidth;
        third.root.classList.add('flash');
      }
      third.wasReady = ready;
    }

    // Out of a fight you get back up alone. In one, the slice's downs wait for a friend (the party UI
    // says so); Hearthgate's (T5) bleed out, and the clock is the thing to watch.
    const bleeding = p.mode === 'down' && inRun && p.bleed !== undefined;
    const showDown = p.mode === 'down' && (!inRun || bleeding);
    this.down.style.display = showDown ? 'block' : 'none';
    if (showDown) {
      this.down.textContent = !inRun
        ? `Down — back up in ${Math.ceil(p.downTime)}`
        : p.bleed! > 0
          ? `Down — bleeding out in ${Math.ceil(p.bleed!)}  ·  a friend can revive you`
          : 'Out until the room is cleared';
    }
    this.draught.style.display = p.draughts === undefined ? 'none' : 'block';
    if (p.draughts !== undefined) this.draught.textContent = `Revive Draught ×${p.draughts}`;
    const potions = p.potions ?? 0;
    if (potions !== this.shownPotions) {
      this.shownPotions = potions;
      this.potion.style.display = potions > 0 ? 'block' : 'none';
      this.potion.innerHTML = `Health potion ×${potions} <kbd>G</kbd>`;
    }
  }

  /** Short word under the crosshair for a parry or a broken guard. */
  private guardPop(text: string, kind: string): void {
    this.guardText.textContent = text;
    this.guardText.className = `hud-guard ${kind}`;
    void this.guardText.offsetWidth;
    this.guardText.classList.add('show');
  }

  /** Stacking notice for level-ups and loot. */
  toast(html: string, kind: string): void {
    const el = document.createElement('div');
    el.className = `hud-toast ${kind}`;
    el.innerHTML = html;
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), TOAST_MS - 500);
    setTimeout(() => el.remove(), TOAST_MS);
  }
}
