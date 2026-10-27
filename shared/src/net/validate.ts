import { STYLES, type Style } from '../config/tuning';
import type { Loadout } from '../sim/coop';
import { emptyMods, type Perk } from '../sim/gear';
import { TALENT_IDS, type TalentRanks } from '../sim/talents';
import type { PlayerCommand } from '../sim/types';
import { checkHandDungeon, readDungeon } from '../level/handmade';
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
  // Worn armour (T5b): a share of damage taken, never more than the most the catalogue allows.
  if (m.armour !== undefined) {
    if (!isNum(m.armour) || m.armour < 0 || m.armour > 0.9) return null;
    mods.armour = m.armour;
  }
  return { name: v.name.replace(/[^\w \-']/g, '').trim().slice(0, 16), xp, talents, mods, maxHp: v.maxHp };
}

/** One message from a player, checked, or null. */
export function readToHost(v: unknown): ToHost | null {
  if (!isObj(v)) return null;
  switch (v.k) {
    case 'hello': {
      const loadout = readLoadout(v.loadout);
      return isNum(v.version) && loadout ? { k: 'hello', version: v.version, loadout } : null;
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
    default:
      return null;
  }
}
