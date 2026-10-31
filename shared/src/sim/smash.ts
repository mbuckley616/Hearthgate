import { tuning } from '../config/tuning';
import type { PropInfo } from '../level/floor';
import { roomFor } from './bagRoom';
import { nextRandom } from './combat';
import type { PlayerState, SimState } from './types';

/**
 * Things to smash and the health potion (D4; Michael, 28 Oct). A generated floor's crates, barrels
 * and urns are level data (floor.ts places them from the seed); the sim keeps only which are broken,
 * so a snapshot grows by a few ids, not by every prop. Any hero's blow breaks one: a swing, a shot,
 * a burst or an ability. A crate or barrel sprays lumber and sometimes coin, an urn stone, which a
 * player walks over to pick up, carried until the floor banks like a find; now and then a potion
 * rolls out, which any hero with room on their belt picks up.
 */

/** How near a blow must come to a prop's centre to break it (m): about a crate's half-width. */
export const PROP_RADIUS = 0.45;

const DEG = Math.PI / 180;

function standing(state: SimState, props: readonly PropInfo[] | undefined): PropInfo[] {
  const broken = state.floor?.broken;
  if (!props || !broken) return [];
  return props.filter((pr) => !broken.includes(pr.id));
}

/** A whole number from lo to hi, both included, from the sim's own dice. */
function roll(state: SimState, lo: number, hi: number): number {
  const a = Math.max(0, Math.round(Math.min(lo, hi)));
  const b = Math.max(0, Math.round(Math.max(lo, hi)));
  return a + Math.min(b - a, Math.floor(nextRandom(state) * (b - a + 1)));
}

/**
 * Throw what a prop held out onto the floor (Michael, 29 Oct): a piece of lumber or stone at a
 * time and coin in up to three piles, each out from the prop's wall into the room, inside a fan,
 * and never past the room's open floor. Where each lands is decided now, so the server, a snapshot
 * and the views agree; the views draw the arc to it.
 */
function spray(state: SimState, pr: PropInfo, kinds: ('lumber' | 'stone' | 'coin')[], amounts: number[]): void {
  const f = state.floor!;
  const l = tuning.loop;
  const loot = (f.loot ??= []);
  const edge = 0.3;
  kinds.forEach((kind, i) => {
    const turn = (nextRandom(state) - 0.5) * (Math.PI * 2) / 3;
    const dist = l.smashSpray * (0.4 + 0.6 * nextRandom(state));
    const yaw = pr.inward + turn;
    const r = pr.room;
    const x = Math.min(r.maxX - edge, Math.max(r.minX + edge, pr.x + Math.sin(yaw) * dist));
    const z = Math.min(r.maxZ - edge, Math.max(r.minZ + edge, pr.z + Math.cos(yaw) * dist));
    loot.push({ id: pr.id * 8 + i, kind, amount: amounts[i], x, y: pr.y, z, fromX: pr.x, fromZ: pr.z, at: state.time });
  });
}

/** Break one prop: what it held sprays out onto the floor, and a potion may roll out. */
function smash(state: SimState, pr: PropInfo, playerId: string): void {
  const f = state.floor!;
  f.broken.push(pr.id);
  const l = tuning.loop;
  const urn = pr.kind === 'urn';
  const lumber = urn ? 0 : roll(state, l.smashLumberMin, l.smashLumberMax);
  const stone = urn ? roll(state, l.smashStoneMin, l.smashStoneMax) : 0;
  // Crates and barrels hold coin too; urns hold stone alone.
  const coin = !urn && nextRandom(state) < l.smashCoinChance ? roll(state, l.smashCoinMin, l.smashCoinMax) : 0;
  const kinds: ('lumber' | 'stone' | 'coin')[] = [];
  const amounts: number[] = [];
  for (let i = 0; i < lumber; i++) kinds.push('lumber'), amounts.push(1);
  for (let i = 0; i < stone; i++) kinds.push('stone'), amounts.push(1);
  const piles = Math.min(3, coin);
  for (let i = 0; i < piles; i++) kinds.push('coin'), amounts.push(Math.floor(coin / piles) + (i < coin % piles ? 1 : 0));
  // Eight pieces a prop at most, so ids never meet the next prop's.
  spray(state, pr, kinds.slice(0, 8), amounts.slice(0, 8));
  const potion = nextRandom(state) < l.potionChance;
  if (potion) f.potions.push({ id: pr.id, x: pr.x, y: pr.y, z: pr.z });
  state.events.push({ kind: 'smashed', playerId, prop: pr.id, propKind: pr.kind, x: pr.x, y: pr.y, z: pr.z, lumber, stone, coin, potion });
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

/**
 * Sprayed lumber, stone and coin go to the first standing player to walk over a piece once it has
 * landed, into the party's found tally: banked with the floor, lost with a wipe. Henchmen take no
 * loot (P10). The server's alone: prediction never takes a piece.
 */
export function stepLoot(state: SimState): void {
  const f = state.floor;
  if (!f?.loot || f.loot.length === 0) return;
  const l = tuning.loop;
  const settle = l.smashSettleMs / 1000;
  f.loot = f.loot.filter((d) => {
    if (state.time - d.at < settle) return true;
    // Lumber and stone go in a bag with room (Michael, 31 Oct, A); a full bag walks over them.
    const inBag = l.materialsInBag && d.kind !== 'coin';
    const p = state.players.find(
      (pl) =>
        !pl.henchman &&
        pl.mode !== 'down' &&
        Math.hypot(pl.x - d.x, pl.z - d.z) <= l.lootRadius &&
        Math.abs(pl.y - d.y) < 1.2 &&
        (!inBag || !pl.bagRoom || roomFor(pl.bagRoom, d.kind as 'lumber' | 'stone')),
    );
    if (!p) return true;
    f.found[d.kind] += d.amount;
    state.events.push({ kind: 'lootTaken', playerId: p.id, loot: d.kind, amount: d.amount, x: d.x, y: d.y, z: d.z });
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
