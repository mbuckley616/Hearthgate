import { tuning } from '../config/tuning';
import { KIND_ROLE } from './roles';
import type { EnemyRole } from './roles';

/** The kinds a generated floor's fight room can hold (the Crypt's roster, E1b to E1f). */
export type RoomKind = 'grunt' | 'archer' | 'brute' | 'shieldbearer' | 'hound' | 'priest' | 'knight';
export const ROOM_COST: Record<RoomKind, number> = { grunt: 1, archer: 2, brute: 4, shieldbearer: 3, hound: 2, priest: 3, knight: 6 };

/**
 * Where a body stands when the room's fight starts, from the heroes' side of the room: `front` holds
 * the line nearest them, `back` stands behind it (bows and the Priest, behind their shields), and
 * `far` is the room's far end (Hounds, which want the length to rush).
 */
export type Place = 'front' | 'back' | 'far';
export interface Placed {
  kind: RoomKind;
  place: Place;
}

export interface RoomContext {
  /** Not a small room or a guard room. */
  big: boolean;
  floor: number;
  difficulty: number;
}

/**
 * How hard a room is in kind (E1h): a step for each difficulty past Normal and each floor past the
 * first. It adds roles and the elite, not health (the design doc's "abilities and modifiers rather
 * than bigger health bars"; G3's multiplier stays the portal's own).
 */
export function roomTier(ctx: RoomContext): number {
  return Math.max(0, ctx.difficulty - 1) + Math.max(0, ctx.floor - 1);
}

/** The specialist roles a room may draw from, the elite apart. The caster joins with the Wraith (E1d). */
const SPECIALISTS: readonly RoomKind[] = ['shieldbearer', 'hound', 'priest', 'brute', 'archer'];
const PLACE: Record<RoomKind, Place> = { grunt: 'front', shieldbearer: 'front', brute: 'front', knight: 'front', archer: 'back', priest: 'back', hound: 'far' };
/** Fallen bodies a Bone Priest can raise (`raisable` in enemies.ts). */
const RAISABLE: readonly RoomKind[] = ['grunt', 'archer', 'shieldbearer'];

/**
 * Compose one group for a fight room (E1h), spending `budget`: first the roles that give the room its
 * problem, each with what makes it a problem (a Shieldbearer screening the bows, a Priest behind a
 * pack it can raise, Hounds with a room's length to rush), then fodder for the rest. A big room draws
 * `dungeon.rolesBase` specialist roles and `dungeon.rolesPerTier` more each tier, up to
 * `dungeon.maxRoles`; the elite (a Barrow Knight) joins from tier 1 where the budget has room left. A small room is fodder and bows,
 * with one specialist from tier 2. Pure: `rand` is the sim's seeded stream.
 */
export function composeRoom(budget: number, ctx: RoomContext, rand: () => number): Placed[] {
  const d = tuning.dungeon;
  const tier = roomTier(ctx);
  const out: Placed[] = [];
  const add = (kind: RoomKind, n = 1) => {
    for (let i = 0; i < n && budget >= ROOM_COST[kind]; i++) {
      out.push({ kind, place: PLACE[kind] });
      budget -= ROOM_COST[kind];
    }
  };
  // Keep enough back for a pack: specialists alone are not a room.
  const reserve = ctx.big ? 3 : 2;
  const roles = ctx.big ? Math.min(Math.round(d.maxRoles), Math.round(d.rolesBase + tier * d.rolesPerTier)) : tier >= 2 ? 1 : 0;
  const pool = SPECIALISTS.filter((k) => ctx.big || k === 'shieldbearer' || k === 'hound');
  // A seeded shuffle, so rooms on one floor differ.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let priest = false;
  for (const kind of pool.slice(0, roles)) {
    if (budget - ROOM_COST[kind] < reserve) continue;
    if (kind === 'priest') {
      // Added last, once there is a pack for it.
      priest = true;
      continue;
    }
    const pair = kind === 'archer' || (tier >= 2 && (kind === 'shieldbearer' || kind === 'hound'));
    add(kind, pair && budget - 2 * ROOM_COST[kind] >= reserve ? 2 : 1);
  }
  // The elite comes after the roles, so a tight room gains a problem before it gains a Knight.
  if (ctx.big && tier >= 1 && budget - ROOM_COST.knight >= reserve) add('knight');
  if (priest) {
    if (budget - ROOM_COST.priest >= 2) budget -= ROOM_COST.priest;
    else priest = false;
  }
  // The rest is fodder, with a bow now and then (D1: grunts alone were a queue), never more bows than blades.
  while (budget >= 1) {
    const bows = out.filter((p) => p.kind === 'archer').length;
    const blades = out.length - bows;
    // A room of fodder alone takes its first bow as soon as two blades can screen it.
    const alone = out.every((p) => p.kind === 'grunt') && !priest;
    if (budget >= ROOM_COST.archer && bows * 2 < blades && (rand() < 0.3 || (alone && blades >= 2))) add('archer');
    else add('grunt');
  }
  if (priest && out.filter((p) => RAISABLE.includes(p.kind)).length >= 2) out.push({ kind: 'priest', place: 'back' });
  return out;
}

/** The roles a composed group holds, for the tests and the critic. */
export function rolesIn(group: readonly Placed[]): Set<EnemyRole> {
  return new Set(group.map((p) => KIND_ROLE[p.kind]));
}
