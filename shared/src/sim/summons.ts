import { enemyStats, tuning } from '../config/tuning';
import { damageEnemy, isTargetable, type HitSpec } from './combat';
import { hasStyleNode } from './specs';
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

/** How many skeletons a Necromancer at this staff level may have standing at once (one more with Restless Dead). */
export function skeletonCap(level: number, owner?: PlayerState): number {
  const n = tuning.necro;
  const past = Math.max(0, level - tuning.specs.level);
  const every = Math.max(1, Math.round(n.extraSkeletonEveryLevels));
  const extra = owner && hasStyleNode(owner, 'staff', 'restless-dead') ? Math.round(n.treeRestlessExtra) : 0;
  return Math.max(0, Math.min(Math.round(n.skeletonMax), Math.round(n.skeletonsAtStart) + Math.floor(past / every)) + extra);
}

/** The level a skeleton raised by a Necromancer at this staff level fights at (all of it with Marrow). */
export function skeletonLevel(level: number, owner?: PlayerState): number {
  const share = owner && hasStyleNode(owner, 'staff', 'marrow') ? tuning.necro.treeMarrowShare : tuning.necro.skeletonLevelShare;
  return Math.max(1, Math.round(level * share));
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
  for (const old of mine.slice(0, Math.max(0, mine.length - skeletonCap(level, owner) + 1))) crumble(state, old, owner);
  // Never an id a crumbled skeleton had, so no view mistakes a new one for the old one.
  let id = `k${state.nextId++}`;
  while (state.players.some((p) => p.id === id)) id = `k${state.nextId++}`;
  const s = createPlayer(id, x, z, owner.yaw);
  s.y = groundHeight(world, x, z);
  applyLoadout(
    s,
    {
      name: 'Skeleton',
      xp: { sword: xpForLevel(skeletonLevel(level, owner)), bow: 0, staff: 0 },
      talents: emptyTalents(),
      mods: emptyMods(),
      maxHp: tuning.combat.heroMaxHp,
    },
    true,
  );
  s.style = 'sword';
  // A share of a hero's health at its level, fixed: it never levels in its short life.
  const thick = hasStyleNode(owner, 'staff', 'thick-bones') ? n.treeThickBonesMult : 1;
  s.maxHp = Math.max(1, Math.round(levelHealth(s, tuning.combat.heroMaxHp) * n.skeletonHealth * thick));
  s.hp = s.maxHp;
  delete s.hpBase;
  s.henchman = true;
  s.summon = { owner: owner.id, until: state.time + (hasStyleNode(owner, 'staff', 'long-dead') ? n.treeLongLifeS : n.skeletonLifeS) };
  state.players.push(s);
  state.events.push({ kind: 'raised', playerId: id, owner: owner.id, x: s.x, z: s.z });
  return s;
}

function crumble(state: SimState, s: PlayerState, owner: PlayerState | undefined): void {
  state.players = state.players.filter((p) => p !== s);
  state.pendingHits = state.pendingHits.filter((h) => h.playerId !== s.id);
  state.events.push({ kind: 'crumbled', playerId: s.id, x: s.x, z: s.z });
  if (owner && hasStyleNode(owner, 'staff', 'corpse-burst')) corpseBurst(state, s, owner);
}

/**
 * Corpse Burst (the Necromancer's tree): a crumbling skeleton bursts in shadow, and every standing
 * enemy within `necro.burstRadiusM` takes `necro.burstDamage` of a Charge's hit as its Necromancer's
 * staff damage. The server's alone, as a summon is.
 */
function corpseBurst(state: SimState, s: PlayerState, owner: PlayerState): void {
  const n = tuning.necro;
  state.events.push({ kind: 'attune', playerId: owner.id, element: 'shadow', x: s.x, y: s.y + 0.9, z: s.z, radius: n.burstRadiusM });
  for (const e of state.enemies) {
    if (!isTargetable(e) || Math.abs(e.y - s.y) > 1.2) continue;
    const dx = e.x - s.x;
    const dz = e.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d > n.burstRadiusM + enemyStats(e.kind).radius) continue;
    const hit: HitSpec = {
      attackerId: owner.id,
      damage: tuning.abilities.chargeDamage * tuning.combat.baseDamage * n.burstDamage,
      poise: 0.5,
      knockback: 0.3,
      heavy: false,
      dirX: d > 0 ? dx / d : 0,
      dirZ: d > 0 ? dz / d : 1,
      x: e.x,
      y: e.y + 1,
      z: e.z,
      style: 'staff',
      area: true,
    };
    damageEnemy(state, e, hit);
  }
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
    if (state.time >= s.summon!.until || s.mode === 'down' || s.hp <= 0 || !owner) crumble(state, s, owner);
  }
}
