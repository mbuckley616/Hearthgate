import { FAMILY_STYLE, OFFHAND_ABILITY, STYLES, tuning, type OffhandKind, type Style, type WeaponFamily } from '../config/tuning';
import type { Loadout } from '../sim/coop';
import { emptyMods, type Perk, type StatKind } from '../sim/gear';
import { BODY_SLOTS, CATALOGUE, type GearItem } from '../sim/catalogue';
import { TALENT_IDS, boardProblem, type TalentRanks } from '../sim/talents';
import { CHAMPION_IDS, SLOTTED_IDS, championProblem, type ChampionRanks, type ChampionState, type SlottedId } from '../sim/champion';
import type { PlayerCommand } from '../sim/types';
import { checkHandDungeon, readDungeon } from '../level/handmade';
import { BUILDINGS, readVillageSave, type BuildingId } from '../game/villageSave';
import { CHEATS, type Cheat, type SeqCommand, type ToHost } from './protocol';

/**
 * The server's checks on what a player sends. In the slice the host trusted its friends' browsers;
 * on a server anything can arrive, and one malformed number in the shared state breaks the fight
 * for everyone in the room. A message that fails is dropped whole. Values are clamped where the
 * slice's own client could not have sent more (a stick pushed past 1), never otherwise changed.
 */

const PERKS: readonly Perk[] = ['bleed', 'chainBolt', 'dodgeRefund', 'hunter'];
/** More ticks than this in one message is not a browser frame; at 60 Hz it is half a second. */
export const MAX_CMDS_PER_MESSAGE = 30;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** A command as the slice's Game builds it, or null. The move stick is clamped to length 1. */
export function readCommand(v: unknown): PlayerCommand | null {
  if (!isObj(v)) return null;
  const { moveX, moveZ, aimX, aimZ, lockTarget, swapTo } = v;
  if (!isNum(moveX) || !isNum(moveZ) || !isNum(aimX) || !isNum(aimZ) || !isNum(lockTarget)) return null;
  for (const k of ['sprint', 'dodge', 'attack', 'ability1', 'ability2', 'jump', 'block', 'interact'] as const) if (!isBool(v[k])) return null;
  if (swapTo !== null && !STYLES.includes(swapTo as Style)) return null;
  if (v.attackHeld !== undefined && !isBool(v.attackHeld)) return null;
  if (v.ability3 !== undefined && !isBool(v.ability3)) return null;
  if (v.drink !== undefined && !isBool(v.drink)) return null;
  if (v.aimPitch !== undefined && !isNum(v.aimPitch)) return null;
  const len = Math.hypot(moveX, moveZ);
  const s = len > 1 ? 1 / len : 1;
  return {
    moveX: moveX * s,
    moveZ: moveZ * s,
    sprint: v.sprint as boolean,
    dodge: v.dodge as boolean,
    attack: v.attack as boolean,
    aimX,
    aimZ,
    swapTo: swapTo as Style | null,
    ability1: v.ability1 as boolean,
    ability2: v.ability2 as boolean,
    lockTarget: Math.trunc(lockTarget),
    jump: v.jump as boolean,
    block: v.block as boolean,
    interact: v.interact as boolean,
    ...(v.attackHeld === true ? { attackHeld: true } : {}),
    ...(v.ability3 === true ? { ability3: true } : {}),
    ...(v.drink === true ? { drink: true } : {}),
    // Straight up or down is as far as a shot can point.
    ...(v.aimPitch !== undefined ? { aimPitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, v.aimPitch as number)) } : {}),
  };
}

function readStyleNumbers(v: unknown, min: number, max: number): Record<Style, number> | null {
  if (!isObj(v)) return null;
  const out = {} as Record<Style, number>;
  for (const s of STYLES) {
    const n = v[s];
    if (!isNum(n) || n < min || n > max) return null;
    out[s] = n;
  }
  return out;
}

/** A saved loadout (the slice's Profile), or null. Its numbers are the player's own to edit (plan T1: accepted until Phase 3). */
export function readLoadout(v: unknown): Loadout | null {
  if (!isObj(v)) return null;
  if (typeof v.name !== 'string' || !isNum(v.maxHp) || v.maxHp < 1 || v.maxHp > 100000) return null;
  const xp = readStyleNumbers(v.xp, 0, 1e9);
  if (!xp) return null;
  if (!isObj(v.talents)) return null;
  const talents = {} as Record<Style, TalentRanks>;
  for (const s of STYLES) {
    const t = v.talents[s];
    if (!isObj(t)) return null;
    const ranks: TalentRanks = {};
    for (const [id, n] of Object.entries(t)) {
      if (!TALENT_IDS.includes(id as never) || !isNum(n) || n < 0 || n > 100) return null;
      ranks[id as keyof TalentRanks] = Math.trunc(n);
    }
    // The board must be one the XP could have bought (plan 3a: the browser keeps it until Phase 2's saves).
    if (boardProblem(xp[s], ranks)) return null;
    talents[s] = ranks;
  }
  const m = v.mods;
  if (!isObj(m)) return null;
  const mods = emptyMods();
  const damage = readStyleNumbers(m.damage, -1, 100);
  const poise = readStyleNumbers(m.poise, -1, 100);
  if (!damage || !poise || !isNum(m.maxHp) || !isNum(m.cooldowns) || !isNum(m.dodgeRecharge) || !Array.isArray(m.perks)) return null;
  if (!m.perks.every((p) => PERKS.includes(p as Perk))) return null;
  mods.damage = damage;
  mods.poise = poise;
  mods.maxHp = m.maxHp;
  mods.cooldowns = m.cooldowns;
  mods.dodgeRecharge = m.dodgeRecharge;
  mods.perks = [...(m.perks as Perk[])];
  // The off-hand and the ammo in use (C4): only kinds there are.
  if (m.offhand !== undefined) {
    if (!Object.keys(OFFHAND_ABILITY).includes(m.offhand as string)) return null;
    mods.offhand = m.offhand as OffhandKind;
  }
  if (m.family !== undefined) {
    if (!Object.keys(FAMILY_STYLE).includes(m.family as string)) return null;
    mods.family = m.family as WeaponFamily;
  }
  if (m.ammo !== undefined) {
    if (m.ammo !== 'frost' && m.ammo !== 'barbed') return null;
    mods.ammo = m.ammo;
  }
  // Worn armour (T5b): a share of damage taken, never more than the most the catalogue allows.
  if (m.armour !== undefined) {
    if (!isNum(m.armour) || m.armour < 0 || m.armour > 0.9) return null;
    mods.armour = m.armour;
  }
  const loadout: Loadout = { name: v.name.replace(/[^\w \-']/g, '').trim().slice(0, 16), xp, talents, mods, maxHp: v.maxHp };
  // Champion points (T6b): the banked XP must have bought every rank.
  if (v.champion !== undefined) {
    const c = v.champion;
    if (!isObj(c) || !isNum(c.xp) || c.xp < 0 || c.xp > 1e12 || !isObj(c.ranks)) return null;
    const ranks: ChampionRanks = {};
    for (const [id, n] of Object.entries(c.ranks)) {
      if (!CHAMPION_IDS.includes(id as never) || !isNum(n) || n < 0) return null;
      ranks[id as keyof ChampionRanks] = Math.trunc(n);
    }
    const champion: ChampionState = { xp: c.xp, ranks };
    // Slotted perks (T6c): known ids; championProblem counts them.
    if (c.slots !== undefined) {
      if (!Array.isArray(c.slots) || c.slots.length > SLOTTED_IDS.length || !c.slots.every((id) => SLOTTED_IDS.includes(id as never))) return null;
      champion.slots = [...(c.slots as SlottedId[])];
    }
    if (championProblem(champion)) return null;
    loadout.champion = champion;
  }
  // What the hero wears (T5c): catalogue ids, at most one a slot. Only drawn, never fought with.
  if (v.look !== undefined) {
    if (!Array.isArray(v.look) || v.look.length > BODY_SLOTS.length) return null;
    const slots = new Set<string>();
    for (const id of v.look) {
      const entry = typeof id === 'string' ? CATALOGUE.get(id) : undefined;
      if (!entry || slots.has(entry.slot)) return null;
      slots.add(entry.slot);
    }
    loadout.look = [...(v.look as string[])];
  }
  // The potion belt (D4): a count, never past what a belt holds.
  if (v.potions !== undefined) {
    if (!isNum(v.potions) || v.potions < 0) return null;
    const n = Math.min(tuning.loop.potionMax, Math.trunc(v.potions));
    if (n > 0) loadout.potions = n;
  }
  return loadout;
}

const STAT_KINDS: readonly StatKind[] = ['damage', 'poise', 'maxHp', 'cooldowns', 'dodgeRecharge'];

/**
 * An item from a player's bag (D13), or null: a catalogue id, a rarity, a known perk, and a bonus no
 * bigger than a roll could give (catalogue.ts: up to 20 health, or 11%; the slice's rares up to 25%).
 */
export function readGearItem(v: unknown): GearItem | null {
  if (!isObj(v)) return null;
  if (typeof v.uid !== 'string' || v.uid.length > 40 || typeof v.id !== 'string' || !CATALOGUE.has(v.id)) return null;
  if (v.rarity !== 'common' && v.rarity !== 'rare') return null;
  if (v.perk !== null && !PERKS.includes(v.perk as Perk)) return null;
  let bonus: GearItem['bonus'] = null;
  if (v.bonus !== null) {
    const b = v.bonus;
    if (!isObj(b) || !STAT_KINDS.includes(b.kind as StatKind) || !isNum(b.value)) return null;
    if (b.value < 0 || b.value > (b.kind === 'maxHp' ? 40 : 0.5)) return null;
    bonus = { kind: b.kind as StatKind, value: b.value };
  }
  const item: GearItem = { uid: v.uid, id: v.id, rarity: v.rarity, perk: v.perk as Perk | null, bonus };
  if (v.name !== undefined) {
    if (typeof v.name !== 'string' || v.name.length > 40) return null;
    item.name = v.name;
  }
  return item;
}

/** One message from a player, checked, or null. */
export function readToHost(v: unknown): ToHost | null {
  if (!isObj(v)) return null;
  switch (v.k) {
    case 'hello': {
      const loadout = readLoadout(v.loadout);
      if (!isNum(v.version) || !loadout) return null;
      if (v.village === undefined) return { k: 'hello', version: v.version, loadout };
      const village = readVillageSave(v.village);
      return village ? { k: 'hello', version: v.version, loadout, village } : null;
    }
    case 'input': {
      if (!Array.isArray(v.cmds) || v.cmds.length > MAX_CMDS_PER_MESSAGE) return null;
      const cmds: SeqCommand[] = [];
      for (const c of v.cmds) {
        if (!isObj(c) || !isNum(c.seq) || !Number.isInteger(c.seq) || c.seq < 1) return null;
        const cmd = readCommand(c.cmd);
        if (!cmd) return null;
        cmds.push({ seq: c.seq, cmd });
      }
      return { k: 'input', cmds };
    }
    case 'loadout': {
      const loadout = readLoadout(v.loadout);
      return loadout ? { k: 'loadout', loadout } : null;
    }
    case 'restart':
      return { k: 'restart' };
    case 'home':
      return { k: 'home' };
    case 'drop': {
      const item = readGearItem(v.item);
      return item ? { k: 'drop', item } : null;
    }
    case 'tune': {
      const e = v.edit;
      if (!isObj(e) || typeof e.path !== 'string' || !(isNum(e.value) || isBool(e.value))) return null;
      return { k: 'tune', edit: { path: e.path, value: e.value } };
    }
    case 'cheat':
      return CHEATS.includes(v.cheat as Cheat) ? { k: 'cheat', cheat: v.cheat as Cheat } : null;
    case 'destination': {
      if (v.dungeon === null) return { k: 'destination', dungeon: null };
      // A layout from a browser is checked whole: one that is not a playable floor is dropped.
      const dungeon = readDungeon(v.dungeon);
      return dungeon && checkHandDungeon(dungeon).playable ? { k: 'destination', dungeon } : null;
    }
    case 'buy':
      return typeof v.uid === 'string' && v.uid.length <= 40 && isNum(v.coin) && v.coin >= 0 ? { k: 'buy', uid: v.uid, coin: Math.floor(v.coin) } : null;
    case 'sell': {
      const item = readGearItem(v.item);
      return item ? { k: 'sell', item } : null;
    }
    case 'upgrade':
      return BUILDINGS.includes(v.building as BuildingId) && isNum(v.coin) && v.coin >= 0 ? { k: 'upgrade', building: v.building as BuildingId, coin: Math.floor(v.coin) } : null;
    default:
      return null;
  }
}
