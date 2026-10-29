import { tuning } from '../config/tuning';
import { groundHeight, type World } from '../level/arena';
import { nextRandom } from './combat';
import { slotted } from './champion';
import { rollGear } from './catalogue';
import { rollItem } from './gear';
import type { GearItem } from './catalogue';
import type { Item } from './gear';
import type { SimState } from './types';

/**
 * Put a rolled item on the floor for every hero (personal loot: each sees and
 * takes only their own). The sim's RNG keeps it host-authoritative.
 */
export function spawnDrop(state: SimState, world: World, x: number, z: number, forceRare: boolean, rareMult = 1): void {
  // Loot is each player's own; a henchman takes none (P3, P10).
  const players = state.players.filter((p) => !p.henchman);
  const n = players.length;
  players.forEach((p, i) => {
    const rand = () => nextRandom(state);
    const item = tuning.gear.catalogue ? rollGear(rand, forceRare, rareMult) : rollItem(rand, forceRare);
    // Spread a party's drops in a small circle so the beams don't overlap.
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    const dx = n > 1 ? x + Math.cos(a) * 0.9 : x;
    const dz = n > 1 ? z + Math.sin(a) * 0.9 : z;
    state.drops.push({ id: state.nextId++, owner: p.id, x: dx, y: groundHeight(world, dx, dz), z: dz, age: 0, item });
    state.events.push({ kind: 'dropSpawned', owner: p.id, x: dx, z: dz, rarity: item.rarity });
  });
}

/**
 * A player puts an item from their bag on the floor at their feet (D13). Only they see it and can
 * take it back, once they have stepped away; it goes when the room does. Handing an item to a friend
 * is a trade, and waits for Phase 3's ledger. Until then the item is the browser's (rule 1's
 * accepted exception), checked by validate.ts as a catalogue item before it gets here.
 */
export function dropFromBag(state: SimState, world: World, playerId: string, item: GearItem): boolean {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p || p.mode === 'down') return false;
  // A cap on what one player may leave lying about, so the snapshot stays small: the oldest goes.
  const mine = state.drops.filter((d) => d.owner === playerId && d.dropped);
  if (mine.length >= tuning.gear.maxDropped) state.drops = state.drops.filter((d) => d !== mine[0]);
  state.drops.push({ id: state.nextId++, owner: playerId, x: p.x, y: groundHeight(world, p.x, p.z), z: p.z, age: 0, item, dropped: true, waitAway: true });
  state.events.push({ kind: 'dropSpawned', owner: playerId, x: p.x, z: p.z, rarity: item.rarity });
  return true;
}

/** Walk over a drop to pick it up. */
export function stepDrops(state: SimState, dt: number): void {
  const r = tuning.gear.pickupRadius;
  for (const d of state.drops) d.age += dt;
  state.drops = state.drops.filter((d) => {
    if (d.waitAway) {
      const owner = state.players.find((pl) => pl.id === d.owner);
      if (owner && Math.hypot(owner.x - d.x, owner.z - d.z) > r * tuning.champion.magnetRadiusMult) delete d.waitAway;
      return true;
    }
    if (d.age < 0.6) return true;
    const p = state.players.find(
      (pl) => pl.id === d.owner && pl.mode !== 'down' && Math.hypot(pl.x - d.x, pl.z - d.z) <= (slotted(pl, 'magnet') ? r * tuning.champion.magnetRadiusMult : r) && Math.abs(pl.y - d.y) < 1.2,
    );
    if (!p) return true;
    // On a generated floor a find is carried until it is banked (P1); the slice's arena hands it over
    // at once, and so does anything a player put down themselves (D13).
    if (state.floor && !d.dropped) {
      (state.floor.carried[p.id] ??= []).push(d.item);
      state.events.push({ kind: 'pickup', playerId: p.id, item: d.item, carried: true });
    } else state.events.push({ kind: 'pickup', playerId: p.id, item: d.item });
    return false;
  });
}

/** When the run ends, anything still on the floor goes to its owner (nothing found is lost). */
export function collectAllDrops(state: SimState): void {
  for (const d of state.drops) state.events.push({ kind: 'pickup', playerId: d.owner, item: d.item });
  state.drops = [];
}

/** Everything a player has found on this floor and not banked: what they carry, and what still lies on the ground for them. */
export function unbanked(state: SimState, playerId: string): (Item | GearItem)[] {
  const carried = state.floor?.carried[playerId] ?? [];
  return [...carried, ...state.drops.filter((d) => d.owner === playerId && !d.dropped).map((d) => d.item)];
}
