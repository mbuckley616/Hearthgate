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
  const n = state.players.length;
  state.players.forEach((p, i) => {
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

/** Walk over a drop to pick it up. */
export function stepDrops(state: SimState, dt: number): void {
  const r = tuning.gear.pickupRadius;
  for (const d of state.drops) d.age += dt;
  state.drops = state.drops.filter((d) => {
    if (d.age < 0.6) return true;
    const p = state.players.find(
      (pl) => pl.id === d.owner && pl.mode !== 'down' && Math.hypot(pl.x - d.x, pl.z - d.z) <= (slotted(pl, 'magnet') ? r * tuning.champion.magnetRadiusMult : r) && Math.abs(pl.y - d.y) < 1.2,
    );
    if (!p) return true;
    // On a generated floor a find is carried until it is banked (P1); the slice's arena hands it over at once.
    if (state.floor) {
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
  return [...carried, ...state.drops.filter((d) => d.owner === playerId).map((d) => d.item)];
}
