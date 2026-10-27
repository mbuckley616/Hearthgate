import { tuning, type Style } from '../config/tuning';
import { groundHeight, type World } from '../level/arena';
import { hurtHero } from './combat';
import type { Mods } from './gear';
import { createPlayer } from './player';
import { reflectFromHero } from './projectiles';
import type { TalentRanks } from './talents';
import type { PlayerCommand, PlayerState, SimState } from './types';

/**
 * Party plumbing (brief: "Co-op"): heroes joining and leaving, revives, and
 * the lag grace that makes remote dodges and parries fair. Solo is a party of
 * one, so all of this runs in single player too.
 */

/** Who a hero is: what each player brings from their own saved profile. */
export interface Loadout {
  name: string;
  xp: Record<Style, number>;
  talents: Record<Style, TalentRanks>;
  mods: Mods;
  maxHp: number;
}

/** Put a loadout on a hero; refill = full health (between runs). */
export function applyLoadout(p: PlayerState, l: Loadout, refill: boolean): void {
  p.name = l.name;
  p.xp = { ...l.xp };
  p.talents = structuredClone(l.talents);
  p.mods = structuredClone(l.mods);
  p.maxHp = l.maxHp;
  p.hp = refill ? p.maxHp : Math.min(p.hp, p.maxHp);
}

/** A friend joins: beside the first standing hero, briefly invulnerable (brief: 2 s). */
export function addPlayer(state: SimState, world: World, id: string, loadout: Loadout, remote: boolean): PlayerState {
  const anchor = state.players.find((p) => p.mode !== 'down') ?? state.players[0];
  const level = world.level;
  const x = anchor ? anchor.x + Math.cos(anchor.yaw) * 1.5 : level.spawn.x;
  const z = anchor ? anchor.z - Math.sin(anchor.yaw) * 1.5 : level.spawn.z;
  const p = createPlayer(id, x, z, anchor ? anchor.yaw : (level.spawn.yawDeg * Math.PI) / 180);
  p.y = groundHeight(world, x, z);
  applyLoadout(p, loadout, true);
  p.invulnTime = tuning.coop.joinInvulnMs / 1000;
  p.lagGrace = remote ? tuning.coop.lagGraceMs / 1000 : 0;
  state.players.push(p);
  state.events.push({ kind: 'playerJoined', playerId: id, name: p.name });
  return p;
}

export function removePlayer(state: SimState, id: string): void {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) return;
  state.players = state.players.filter((pl) => pl.id !== id);
  state.drops = state.drops.filter((d) => d.owner !== id);
  state.pendingHits = state.pendingHits.filter((h) => h.playerId !== id);
  state.events.push({ kind: 'playerLeft', playerId: id, name: p.name });
}

/** Hold interact next to a downed ally for coop.reviveMs to bring them back. */
export function stepRevives(state: SimState, commands: Record<string, PlayerCommand>, dt: number): void {
  const c = tuning.coop;
  for (const down of state.players) {
    if (down.mode !== 'down') {
      down.reviveProgress = 0;
      continue;
    }
    const helper = state.players.find(
      (p) =>
        p !== down &&
        (p.mode === 'move' || p.mode === 'guard') &&
        commands[p.id]?.interact &&
        Math.hypot(p.x - down.x, p.z - down.z) <= c.reviveRadius &&
        Math.abs(p.y - down.y) < 1.2,
    );
    if (!helper) {
      // Letting go loses progress quickly but not instantly.
      down.reviveProgress = Math.max(0, down.reviveProgress - dt * 2);
      continue;
    }
    down.reviveProgress += dt;
    if (down.reviveProgress * 1000 >= c.reviveMs) {
      down.mode = 'move';
      down.hp = Math.max(1, down.maxHp * c.reviveHpFrac);
      down.invulnTime = tuning.combat.reviveInvulnMs / 1000;
      down.reviveProgress = 0;
      down.downTime = 0;
      state.events.push({ kind: 'revived', playerId: down.id, by: helper.id });
    }
  }
}

/**
 * Hits on remote players land after their lag grace, or straight away once
 * they dodge or guard. A dodge that started in time is then invulnerable, and
 * a guard raised in time parries: what was on time on their screen counts.
 */
export function stepPendingHits(state: SimState): void {
  if (state.pendingHits.length === 0) return;
  const keep: typeof state.pendingHits = [];
  for (const ph of state.pendingHits) {
    const p = state.players.find((pl) => pl.id === ph.playerId);
    if (!p) continue;
    const due = state.time - ph.at >= p.lagGrace || p.mode === 'dodge' || p.mode === 'guard' || p.mode === 'down';
    if (!due) {
      keep.push(ph);
      continue;
    }
    const result = hurtHero(state, p, { ...ph.hit, late: true });
    if (result === 'parried' && ph.hit.arrow && ph.hit.enemyId !== undefined) reflectFromHero(state, p, ph.hit.damage, ph.hit.enemyId);
  }
  state.pendingHits = keep;
}
