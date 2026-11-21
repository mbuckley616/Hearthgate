import { tuning } from '../config/tuning';
import type { EnemyState, PlayerState, SimState } from './types';

/**
 * Pilfer (E1i, the Goblin Warrens' twist; Michael's A, 19 Nov): a Goblin Cutter's cut that lands on
 * a hero snatches a share of the party's found coin on this floor. The thief stops fighting and runs
 * from the party (`thiefFlees`, in the fodder brain) with the sack, and spills it back onto the floor
 * where it dies (`spillSack`), so a cleared room loses nothing. Only coin: the lumber and stone the
 * party finds are in its bags, which are the browsers' until Phase 3's ledger (`decisions.md`).
 */
export function pilferOn(state: SimState, p: PlayerState, enemyId: number | undefined): void {
  const t = tuning.pilfer;
  const f = state.floor;
  if (!t.enabled || !f || enemyId === undefined) return;
  const e = state.enemies.find((o) => o.id === enemyId);
  if (!e || e.kind !== 'cutter' || e.ai === 'dead' || e.sack) return;
  const have = Math.floor(f.found.coin);
  if (have <= 0) return;
  const coin = Math.min(have, Math.max(Math.round(t.min), Math.round(have * t.share)));
  if (coin <= 0) return;
  f.found.coin -= coin;
  e.sack = coin;
  // A thief has stopped fighting: its turn at the hero goes to another.
  e.hasToken = false;
  state.events.push({ kind: 'pilfered', playerId: p.id, enemyId: e.id, coin });
}

/** A thief's sack spills where it falls, to be picked up as any coin on the floor is. */
export function spillSack(state: SimState, e: EnemyState): void {
  const f = state.floor;
  const coin = e.sack;
  if (!coin) return;
  delete e.sack;
  if (!f) return;
  // Negative ids keep clear of the smashed props' (prop id times eight, plus the piece).
  (f.loot ??= []).push({ id: -state.nextId++, kind: 'coin', amount: coin, x: e.x, y: e.y, z: e.z, fromX: e.x, fromZ: e.z, at: state.time });
}
