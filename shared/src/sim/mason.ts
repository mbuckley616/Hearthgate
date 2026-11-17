import { tuning } from '../config/tuning';
import type { BoxCollider, Collider } from '../level/geometry';
import type { BoneRidge, EnemyState, SimState } from './types';

/**
 * The Ossuary Mason's rule (M1; `docs/bosses.md` 2.2): tanky by rule, not by health. While any of its
 * Wardstones stand it is Bound, and every hit on it lands at `mason.boundTaken`.
 */
export function masonBound(state: Pick<SimState, 'enemies'>): boolean {
  return state.enemies.some((o) => o.kind === 'wardstone' && o.ai !== 'dead');
}

/** A Mason standing that can still be Bound: not fallen, and not past its third phase's roar (M3). */
export function masonBinds(state: Pick<SimState, 'enemies'>): boolean {
  return state.enemies.some((o) => o.kind === 'mason' && o.ai !== 'dead' && o.phase < 3);
}

/** What a hit on `e` is multiplied by for the Bound rule: 1 for anything but a Bound Mason. */
export function boundMult(state: Pick<SimState, 'enemies'>, e: Pick<EnemyState, 'kind'>): number {
  return e.kind === 'mason' && masonBound(state) ? tuning.mason.boundTaken : 1;
}

/**
 * Phase 2's bone ridge (M3): the overhead raises a short wall across its swing, `ridgeAheadM` past
 * the maul's reach, so it lies behind the hero it struck and splits the hall. Snapped to the hall's
 * axes (the walls are boxes): across x when the Mason faces more along z, and the other way round.
 * The oldest past `maxRidges` crumbles. Server-side, in the Mason's brain; prediction meets it as a wall.
 */
export function raiseRidge(state: SimState, e: Pick<EnemyState, 'x' | 'y' | 'z' | 'yaw'>): BoneRidge | null {
  const m = tuning.mason;
  const max = Math.round(m.maxRidges);
  if (max <= 0 || m.ridgeLengthM <= 0 || m.ridgeLifeMs <= 0) return null;
  const ahead = m.stringReach + m.ridgeAheadM;
  const fx = Math.sin(e.yaw);
  const fz = Math.cos(e.yaw);
  const ridge: BoneRidge = {
    id: state.nextId++,
    x: e.x + fx * ahead,
    y: e.y,
    z: e.z + fz * ahead,
    alongX: Math.abs(fz) >= Math.abs(fx),
    half: m.ridgeLengthM / 2,
    until: state.time + m.ridgeLifeMs / 1000,
  };
  const ridges = (state.ridges ??= []);
  ridges.push(ridge);
  while (ridges.length > max) ridges.shift();
  return ridge;
}

/** A ridge as the wall it is: blocks movement, arrows and line of sight; the camera sees past it. */
export function ridgeCollider(r: BoneRidge): BoxCollider {
  const m = tuning.mason;
  const t = m.ridgeThickM / 2;
  const hx = r.alongX ? r.half : t;
  const hz = r.alongX ? t : r.half;
  return {
    kind: 'box',
    id: `ridge-${r.id}`,
    min: { x: r.x - hx, y: r.y, z: r.z - hz },
    max: { x: r.x + hx, y: r.y + m.ridgeHeightM, z: r.z + hz },
    blocksMovement: true,
    blocksCamera: false,
    fadeable: false,
  };
}

/** The colliders with this tick's ridges added; the same array when none stand. */
export function withRidges(colliders: Collider[], state: Pick<SimState, 'ridges'>): Collider[] {
  return state.ridges?.length ? [...colliders, ...state.ridges.map(ridgeCollider)] : colliders;
}

/** Ridges past their time crumble, and every one does once no Mason stands. */
export function stepRidges(state: SimState): void {
  const mason = state.enemies.some((o) => o.kind === 'mason' && o.ai !== 'dead');
  const live = mason ? state.ridges!.filter((r) => r.until > state.time) : [];
  if (live.length === 0) delete state.ridges;
  else state.ridges = live;
}
