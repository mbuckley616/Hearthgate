import { tuning } from '../config/tuning';
import { groundHeight, type World } from '../level/arena';
import { applyLoadout } from './coop';
import { emptyMods, levelFor, xpForLevel } from './gear';
import { createPlayer, levelHealth } from './player';
import { emptyTalents } from './talents';
import type { PlayerState, SimState } from './types';

/**
 * The Necromancer's skeletons (the builds pass's last part; Michael's A, 12 Nov): a summon is a
 * henchman raised in the fight, so the henchman brain, the fight, the snapshots and the views carry
 * it as they carry a hire. What makes it a summon is `PlayerState.summon`: whose it is and when it
 * crumbles. It is the server's alone (its brain runs only there, and prediction never steps it); it
 * never banks, never takes a hire's place in the party, and never follows its party through a door
 * to another room. More stand at once, and each fights harder, as its Necromancer's staff level grows
 * (Michael, 28 Oct: "necromancer progression should allow them to summon stronger henchmen").
 */

/** How many skeletons a Necromancer at this staff level may have standing at once. */
export function skeletonCap(level: number): number {
  const n = tuning.necro;
  const past = Math.max(0, level - tuning.specs.level);
  const every = Math.max(1, Math.round(n.extraSkeletonEveryLevels));
  return Math.max(0, Math.min(Math.round(n.skeletonMax), Math.round(n.skeletonsAtStart) + Math.floor(past / every)));
}

/** The level a skeleton raised by a Necromancer at this staff level fights at. */
export function skeletonLevel(level: number): number {
  return Math.max(1, Math.round(level * tuning.necro.skeletonLevelShare));
}

/** This hero's skeletons standing now, oldest first. */
export function summonsOf(state: SimState, owner: string): PlayerState[] {
  return state.players.filter((p) => p.summon?.owner === owner);
}

/** The party without its summons: the heroes and hires a party's size counts. */
export function partyOf(state: SimState): PlayerState[] {
  return state.players.filter((p) => !p.summon);
}

/**
 * Raise a skeleton beside its Necromancer, facing as it faces. At the cap the oldest crumbles to
 * make room, so a press is never wasted. Returns the skeleton. Server only: a summon is a new party
 * member, so prediction (which steps only the player's own hero) never calls this.
 */
export function raiseSkeleton(state: SimState, world: World, owner: PlayerState, x = owner.x + Math.sin(owner.yaw) * 1.5, z = owner.z + Math.cos(owner.yaw) * 1.5): PlayerState {
  const n = tuning.necro;
  const level = levelFor(owner.xp.staff);
  const mine = summonsOf(state, owner.id);
  for (const old of mine.slice(0, Math.max(0, mine.length - skeletonCap(level) + 1))) crumble(state, old);
  // Never an id a crumbled skeleton had, so no view mistakes a new one for the old one.
  let id = `k${state.nextId++}`;
  while (state.players.some((p) => p.id === id)) id = `k${state.nextId++}`;
  const s = createPlayer(id, x, z, owner.yaw);
  s.y = groundHeight(world, x, z);
  applyLoadout(
    s,
    {
      name: 'Skeleton',
      xp: { sword: xpForLevel(skeletonLevel(level)), bow: 0, staff: 0 },
      talents: emptyTalents(),
      mods: emptyMods(),
      maxHp: tuning.combat.heroMaxHp,
    },
    true,
  );
  s.style = 'sword';
  // A share of a hero's health at its level, fixed: it never levels in its short life.
  s.maxHp = Math.max(1, Math.round(levelHealth(s, tuning.combat.heroMaxHp) * n.skeletonHealth));
  s.hp = s.maxHp;
  delete s.hpBase;
  s.henchman = true;
  s.summon = { owner: owner.id, until: state.time + n.skeletonLifeS };
  state.players.push(s);
  state.events.push({ kind: 'raised', playerId: id, owner: owner.id, x: s.x, z: s.z });
  return s;
}

function crumble(state: SimState, s: PlayerState): void {
  state.players = state.players.filter((p) => p !== s);
  state.pendingHits = state.pendingHits.filter((h) => h.playerId !== s.id);
  state.events.push({ kind: 'crumbled', playerId: s.id, x: s.x, z: s.z });
}

/**
 * Each tick, after the skeletons asked for are raised: a skeleton whose time is up, that has fallen (a summon is never revived), or whose
 * Necromancer has left the room crumbles.
 */
export function stepSummons(state: SimState, world: World): void {
  // What a Necromancer's Q or E asked for this tick (askSkeleton), raised here on the server alone.
  for (const p of state.players) {
    if (!p.raise) continue;
    const asks = p.raise;
    delete p.raise;
    if (p.mode === 'down') continue;
    for (const at of asks) raiseSkeleton(state, world, p, at.x, at.z);
  }
  for (const s of state.players.filter((p) => p.summon)) {
    const owner = state.players.find((p) => p.id === s.summon!.owner);
    if (state.time >= s.summon!.until || s.mode === 'down' || s.hp <= 0 || !owner) crumble(state, s);
  }
}
