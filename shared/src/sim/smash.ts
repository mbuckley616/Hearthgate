import { tuning } from '../config/tuning';
import type { PropInfo } from '../level/floor';
import { nextRandom } from './combat';
import type { PlayerState, SimState } from './types';

/**
 * Things to smash and the health potion (D4; Michael, 28 Oct). A generated floor's crates, barrels
 * and urns are level data (floor.ts places them from the seed); the sim keeps only which are broken,
 * so a snapshot grows by a few ids, not by every prop. Any hero's blow breaks one: a swing, a shot,
 * a burst or an ability. A crate or barrel gives lumber, an urn stone, carried until the floor banks
 * like a find; now and then a potion rolls out, which any hero with room on their belt picks up.
 */

/** How near a blow must come to a prop's centre to break it (m): about a crate's half-width. */
export const PROP_RADIUS = 0.45;

const DEG = Math.PI / 180;

function standing(state: SimState, props: readonly PropInfo[] | undefined): PropInfo[] {
  const broken = state.floor?.broken;
  if (!props || !broken) return [];
  return props.filter((pr) => !broken.includes(pr.id));
}

/** Break one prop: what it gives goes to the floor's carried resources, and a potion may roll out. */
function smash(state: SimState, pr: PropInfo, playerId: string): void {
  const f = state.floor!;
  f.broken.push(pr.id);
  const l = tuning.loop;
  const lumber = pr.kind === 'urn' ? 0 : l.smashLumber;
  const stone = pr.kind === 'urn' ? l.smashStone : 0;
  f.found.lumber += lumber;
  f.found.stone += stone;
  const potion = nextRandom(state) < l.potionChance;
  if (potion) f.potions.push({ id: pr.id, x: pr.x, y: pr.y, z: pr.z });
  state.events.push({ kind: 'smashed', playerId, prop: pr.id, propKind: pr.kind, x: pr.x, y: pr.y, z: pr.z, lumber, stone, potion });
}

/** A blow around a point (a burst, a whirlwind's turn, a frost ring): every prop inside it breaks. */
export function smashCircle(state: SimState, props: readonly PropInfo[] | undefined, playerId: string, x: number, y: number, z: number, radius: number): void {
  for (const pr of standing(state, props)) {
    if (Math.abs(pr.y - y) > 1.2 || Math.hypot(pr.x - x, pr.z - z) > radius + PROP_RADIUS) continue;
    smash(state, pr, playerId);
  }
}

/** A swing: the props inside its reach and arc, as swordHits takes enemies. */
export function smashArc(state: SimState, props: readonly PropInfo[] | undefined, p: PlayerState, cx: number, cz: number, range: number, arcDeg: number): void {
  for (const pr of standing(state, props)) {
    if (Math.abs(pr.y - p.y) > 1.2 || Math.hypot(pr.x - cx, pr.z - cz) > range + PROP_RADIUS) continue;
    if (arcDeg < 360) {
      const off = Math.atan2(pr.x - p.x, pr.z - p.z) - p.yaw;
      if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > (arcDeg * DEG) / 2) continue;
    }
    smash(state, pr, p.id);
  }
}

/** The first standing prop a shot's path meets within len, and how far along, or null. */
export function propOnPath(
  state: SimState,
  props: readonly PropInfo[] | undefined,
  from: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  len: number,
): { prop: PropInfo; t: number } | null {
  let best: { prop: PropInfo; t: number } | null = null;
  const flat = Math.hypot(dir.x, dir.z);
  if (flat < 1e-6) return null;
  for (const pr of standing(state, props)) {
    // Flat distance along the path to the prop's nearest point, then the height there: a prop stands about a metre tall.
    const dx = pr.x - from.x;
    const dz = pr.z - from.z;
    const along = (dx * dir.x + dz * dir.z) / flat;
    const miss2 = dx * dx + dz * dz - along * along;
    if (miss2 > PROP_RADIUS * PROP_RADIUS) continue;
    const half = Math.sqrt(PROP_RADIUS * PROP_RADIUS - miss2);
    // Behind the shot: it has already left this one.
    if (along + half < 0) continue;
    const t = Math.max(0, along - half) / flat;
    if (t > len || (best && t >= best.t)) continue;
    const y = from.y + dir.y * t;
    if (y < pr.y - 0.2 || y > pr.y + 1.1) continue;
    best = { prop: pr, t };
  }
  return best;
}

/** A shot that met a prop breaks it. */
export function smashProp(state: SimState, pr: PropInfo, playerId: string): void {
  if (state.floor && !state.floor.broken.includes(pr.id)) smash(state, pr, playerId);
}

/** Potions on the floor go to the first standing hero to walk over one with room on their belt. */
export function stepPotions(state: SimState): void {
  const f = state.floor;
  if (!f || f.potions.length === 0) return;
  const r = tuning.gear.pickupRadius;
  f.potions = f.potions.filter((pt) => {
    const p = state.players.find(
      (pl) => pl.mode !== 'down' && (pl.potions ?? 0) < tuning.loop.potionMax && Math.hypot(pl.x - pt.x, pl.z - pt.z) <= r && Math.abs(pl.y - pt.y) < 1.2,
    );
    if (!p) return true;
    p.potions = (p.potions ?? 0) + 1;
    state.events.push({ kind: 'potionTaken', playerId: p.id, potions: p.potions });
    return false;
  });
}

/** Drink a potion (G, 4 or d-pad left): some health back at once, if there is one to drink and health to gain. */
export function drinkPotion(state: SimState, p: PlayerState): void {
  const l = tuning.loop;
  if (!p.potions || p.mode === 'down' || (p.potionCooldown ?? 0) > 0 || p.hp >= p.maxHp) return;
  p.potions--;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * l.potionHeal);
  p.potionCooldown = l.potionCooldownMs / 1000;
  state.events.push({ kind: 'drank', playerId: p.id, potions: p.potions });
}
