import { tuning } from '../config/tuning';
import { groundHeight, type World } from '../level/arena';
import { insidePiece, type PieceInfo } from '../level/floor';
import { SIDE_DIR } from '../level/kit';
import { nextRandom } from './combat';
import { spawnDrop, unbanked } from './drops';
import { createEnemy, willRise } from './enemies';
import { stepPotions } from './smash';
import { difficultyMult } from '../game/portalChoice';
import type { EnemyKind } from '../config/tuning';
import type { GearItem } from './catalogue';
import type { Item } from './gear';
import type { SimState } from './types';

/**
 * A generated floor's run (T4): the slice's arena run, room by room. The party explores freely;
 * when a standing hero steps into a fight room not yet cleared, its fight starts and the rest of the
 * party walk in when they like (D8). With dungeon.shutDoors (T4's way) its doors wait for the rest
 * of the party (the slice's gate wait), then close behind them, bringing in anyone outside. The
 * room's group comes from a budget (its size, the floor, the party), with the slice's
 * reinforcements once it is mostly down; clearing it opens the doors. Health comes back only in
 * the rest room (D7), not after every room as the slice's waves gave it.
 * The last floor's Warden ends the run; a wipe ends it anywhere. The rest room at the end of every
 * other floor banks the party's drops; its rings (game/portal.ts) lead deeper or home.
 *
 * Reuses the slice's RunState for the phase, timers, gate and boss (so the HUD, sound and revives
 * read it as they do in the arena); what only a floor has lives in SimState.floor, which the arena
 * never sets, so the arena's state (and the parity hashes) never carry it.
 */
export interface FloorRunState {
  /** The fight room whose doors are shut, or -1. */
  room: number;
  /** Fight rooms cleared, by piece id, in the order they fell. */
  cleared: number[];
  /** Fights started on this floor (the banner's count). */
  fights: number;
  /** The party has reached the rest room and banked its drops. */
  rested: boolean;
  /** Finds picked up on this floor and not yet banked, by player (P1): a wipe loses them. */
  carried: Record<string, (Item | GearItem)[]>;
  /** The props smashed so far (D4), by id in the layout's `props`. */
  broken: number[];
  /** Lumber and stone from smashing, the party's, banked with the floor or lost with it (D4). */
  found: { lumber: number; stone: number };
  /** Potions lying where a prop broke, by that prop's id (D4). */
  potions: { id: number; x: number; y: number; z: number }[];
  /** The run's twist (P8), from the floor's spec: absent for none. */
  modifier?: 'cursed' | 'haunted';
}

export function initialFloorRun(): FloorRunState {
  return { room: -1, cleared: [], fights: 0, rested: false, carried: {}, broken: [], found: { lumber: 0, stone: 0 }, potions: [] };
}

const active = (phase: string) => phase === 'intro' || phase === 'wave' || phase === 'rest';

/** The world as it stands this tick: the fight room's doors shut while it is being fought. */
export function floorWorldNow(world: World, state: SimState): World {
  const room = state.floor?.room ?? -1;
  if (!state.run.gateClosed || room < 0 || !world.roomColliders) return { ...world, colliders: world.collidersOpen };
  return { ...world, colliders: world.roomColliders[room] };
}

export function stepFloorRun(state: SimState, dt: number, world: World): void {
  const r = state.run;
  const f = (state.floor ??= initialFloorRun());
  const layout = world.level.dungeon!;
  r.timer += dt;
  if (active(r.phase)) r.elapsed += dt;
  const standing = state.players.filter((p) => p.mode !== 'down');

  switch (r.phase) {
    case 'ante': {
      // The rest room banks what the party carries, once they are all in it.
      const rest = layout.pieces[layout.def.exit];
      // The players reach the rest room together; a henchman lagging behind does not hold up the bank.
      const party = standing.filter((p) => !p.henchman);
      if (!f.rested && rest.kind === 'rest' && party.length > 0 && party.every((p) => insidePiece(rest, p.x, p.z))) {
        f.rested = true;
        for (const p of standing) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * tuning.dungeon.restHeal);
        bank(state, world, f);
        state.events.push({ kind: 'rested' });
      }
      const room = tuning.debug.enemiesEnabled ? roomEntered(state, layout.pieces, f) : null;
      if (!room) {
        r.gateWait = -1;
        break;
      }
      // Open doors (D8): the fight starts on the first hero in, and the rest walk in when they like.
      const shut = tuning.dungeon.shutDoors;
      if (shut) {
        r.gateWait = r.gateWait < 0 ? 0 : r.gateWait + dt;
        const inside = standing.filter((p) => insidePiece(room, p.x, p.z));
        if (inside.length < standing.length && r.gateWait * 1000 < tuning.run.gateWaitMs) break;
        bringStragglersIn(state, world, room);
      }
      f.room = room.id;
      f.fights++;
      r.phase = 'intro';
      r.timer = 0;
      r.gateWait = -1;
      r.gateClosed = shut;
      r.reinforced = false;
      if (f.fights === 1) state.events.push({ kind: 'runStart' });
      break;
    }
    case 'intro':
      if (r.timer >= tuning.run.introMs / 1000) startRoomFight(state, world, layout.pieces[f.room]);
      break;
    case 'wave': {
      const room = layout.pieces[f.room];
      // Haunted (P8): a fallen enemy that will still get up keeps the room from clearing.
      const alive = state.enemies.filter((e) => e.ai !== 'dead' || willRise(state, e)).length;
      if (!r.reinforced && room.kind !== 'boss' && alive <= Math.floor(r.waveSize * tuning.run.reinforceAt)) {
        r.reinforced = true;
        if (spawnRoomGroup(state, world, room, 'reinforce') > 0) state.events.push({ kind: 'reinforcements', wave: r.wave });
        break;
      }
      if (alive > 0) break;
      state.events.push({ kind: 'waveCleared', wave: r.wave });
      for (const p of state.players) if (p.mode !== 'down') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * tuning.dungeon.healOnClear);
      f.cleared.push(room.id);
      f.room = -1;
      r.gateClosed = false;
      // The big rooms drop loot where the last enemy fell; the Warden's is rare.
      if (room.kind === 'large' || room.kind === 'arena' || room.kind === 'greatHall' || room.kind === 'cavern' || room.kind === 'boss') {
        spawnDrop(state, world, r.dropX, r.dropZ, room.kind === 'boss', depthMult(world));
        // Cursed (P8): double loot, for no revives.
        if (f.modifier === 'cursed') spawnDrop(state, world, r.dropX + 0.8, r.dropZ, room.kind === 'boss', depthMult(world));
      }
      if (room.kind === 'boss') {
        r.phase = 'won';
        r.timer = 0;
        bank(state, world, f);
        state.events.push({ kind: 'runWon', time: r.elapsed });
      } else {
        r.phase = 'ante';
        r.timer = 0;
      }
      break;
    }
  }

  stepPotions(state);

  if (active(r.phase) && state.players.length > 0 && state.players.every((p) => p.mode === 'down')) {
    r.phase = 'lost';
    r.timer = 0;
    r.gateClosed = false;
    loseUnbanked(state, f);
    state.events.push({ kind: 'runLost', wave: r.wave });
  }
}

/** What a floor pays over the first: depthBonus more for each floor deeper (P1). */
export function depthMult(world: World): number {
  const spec = world.level.dungeon?.def.spec;
  // A harder portal (P7) pays as much more as it sends.
  return (1 + tuning.loop.depthBonus * ((spec?.floor ?? 1) - 1)) * difficultyMult(spec?.difficulty);
}

/**
 * Bank the floor (P1): every player's carried finds and any still on the ground for them go home
 * with them, with coin for the fight rooms cleared here, and the village's lumber and stone.
 */
function bank(state: SimState, world: World, f: FloorRunState): void {
  const l = tuning.loop;
  const pieces = world.level.dungeon!.pieces;
  const rooms = f.cleared.length;
  const boss = f.cleared.some((id) => pieces[id]?.kind === 'boss') ? 1 : 0;
  const mult = depthMult(world);
  const pay = (perRoom: number, forBoss: number) => Math.round((rooms * perRoom + boss * forBoss) * mult);
  const coin = pay(l.coinPerRoom, l.bossCoin);
  // What the party smashed (D4) pays the deeper floors' bonus too.
  const lumber = pay(l.lumberPerRoom, l.bossLumber) + Math.round(f.found.lumber * mult);
  const stone = pay(l.stonePerRoom, l.bossStone) + Math.round(f.found.stone * mult);
  const floor = world.level.dungeon!.def.spec.floor;
  // Carried finds are in the browser's bag already (D3): the bank makes them safe. Finds still on the ground come now.
  for (const p of state.players) {
    const kept = (f.carried[p.id] ?? []).length;
    const items = state.drops.filter((d) => d.owner === p.id && !d.dropped).map((d) => d.item);
    state.events.push({ kind: 'banked', playerId: p.id, items, kept, coin, lumber, stone, floor });
  }
  f.carried = {};
  f.found = { lumber: 0, stone: 0 };
  // What a player put down themselves (D13) stays where it is.
  state.drops = state.drops.filter((d) => d.dropped);
}

/** A wipe (P1): what was carried since the last bank, and what still lay on the ground, is gone. */
function loseUnbanked(state: SimState, f: FloorRunState): void {
  for (const p of state.players) {
    const count = unbanked(state, p.id).length;
    if (count > 0) state.events.push({ kind: 'findsLost', playerId: p.id, count });
    state.events.push({ kind: 'bagLost', playerId: p.id });
  }
  f.carried = {};
  f.found = { lumber: 0, stone: 0 };
  state.drops = [];
}

/** The uncleared fight room a standing hero has stepped into (a little past its doorway), or null. */
function roomEntered(state: SimState, pieces: PieceInfo[], f: FloorRunState): PieceInfo | null {
  for (const p of state.players) {
    if (p.mode === 'down') continue;
    for (const room of pieces) {
      if (!room.fight || f.cleared.includes(room.id)) continue;
      if (insidePiece(room, p.x, p.z, 1)) return room;
    }
  }
  return null;
}

/** Anyone still outside when the doors close is brought in, just inside the doorway nearest them. */
function bringStragglersIn(state: SimState, world: World, room: PieceInfo): void {
  const doors = room.doors.filter((d) => d.open);
  for (const p of state.players) {
    if (insidePiece(room, p.x, p.z)) continue;
    const door = [...doors].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    const dir = SIDE_DIR[door.side];
    p.x = door.x - dir.x * 2;
    p.z = door.z - dir.z * 2;
    p.y = groundHeight(world, p.x, p.z);
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.grounded = true;
  }
}

function startRoomFight(state: SimState, world: World, room: PieceInfo): void {
  const r = state.run;
  const f = state.floor!;
  r.phase = 'wave';
  r.wave = f.fights;
  r.timer = 0;
  r.reinforced = false;
  // The last room's fallen go now, so a long floor's snapshots never carry every corpse on it.
  state.enemies = state.enemies.filter((e) => e.ai !== 'dead');
  const boss = room.kind === 'boss';
  if (boss) {
    const c = { x: (room.inner.minX + room.inner.maxX) / 2, z: (room.inner.minZ + room.inner.maxZ) / 2 };
    const e = createEnemy(state, world, 'warden', c.x, c.z, 0);
    r.bossId = e.id;
    r.waveSize = 1;
  } else {
    r.waveSize = spawnRoomGroup(state, world, room, 'first');
  }
  state.events.push({ kind: 'waveStart', wave: r.wave, title: room.title, boss });
}

const COST: Record<'grunt' | 'archer' | 'brute', number> = { grunt: 1, archer: 2, brute: 4 };

/** A room's enemy budget: its floor area, deeper floors and more players raising it (tuning.dungeon). */
export function roomBudget(room: PieceInfo, floor: number, players: number): number {
  const d = tuning.dungeon;
  const cells = ((room.bounds.maxX - room.bounds.minX) * (room.bounds.maxZ - room.bounds.minZ)) / 36;
  return cells * d.budgetPerCell * (1 + (floor - 1) * d.budgetPerFloor) + Math.max(0, players - 1) * d.budgetPerExtraPlayer;
}

/**
 * Spend part of the room's budget on enemies at its spots farthest from the heroes, as the slice
 * spawns a wave on the far side of the arena. Any room mixes grunts and archers (D1: a guard room of
 * grunts alone was a queue); brutes come in the bigger ones. Returns how many spawned.
 */
function spawnRoomGroup(state: SimState, world: World, room: PieceInfo, part: 'first' | 'reinforce'): number {
  const spec = world.level.dungeon!.def.spec;
  const share = part === 'first' ? tuning.dungeon.firstGroupShare : 1 - tuning.dungeon.firstGroupShare;
  // A harder portal (P7) fills every room more.
  let budget = Math.max(1, Math.round(roomBudget(room, spec.floor, state.players.length) * share * difficultyMult(spec.difficulty)));
  const big = room.kind !== 'small' && room.kind !== 'guard';
  // A guard room keeps at least two blades for every bow, so its archers have someone to hide behind.
  let archers = 0;
  const avgX = state.players.reduce((s, p) => s + p.x, 0) / Math.max(1, state.players.length);
  const avgZ = state.players.reduce((s, p) => s + p.z, 0) / Math.max(1, state.players.length);
  const spots = [...room.spots].sort((a, b) => Math.hypot(b.x - avgX, b.z - avgZ) - Math.hypot(a.x - avgX, a.z - avgZ));
  const far = spots.slice(0, Math.max(3, Math.ceil(spots.length / 2)));
  const kinds: EnemyKind[] = [];
  let brutes = 0;
  while (budget >= 1) {
    const roll = nextRandom(state);
    let kind: 'grunt' | 'archer' | 'brute' = 'grunt';
    if (big && budget >= COST.brute && brutes < 1 + Math.floor(spec.floor / 2) && roll < 0.18) kind = 'brute';
    else if (budget >= COST.archer && roll < 0.45 && (big || archers * 2 < kinds.length)) kind = 'archer';
    if (kind === 'brute') brutes++;
    if (kind === 'archer') archers++;
    kinds.push(kind);
    budget -= COST[kind];
  }
  kinds.forEach((kind, i) => {
    const pt = far[i % far.length];
    const a = nextRandom(state) * Math.PI * 2;
    // Several on one spot stand round it.
    const ring = i < far.length ? 0 : 1.2;
    const x = pt.x + Math.cos(a) * ring;
    const z = pt.z + Math.sin(a) * ring;
    createEnemy(state, world, kind, x, z, Math.atan2(avgX - x, avgZ - z));
  });
  return kinds.length;
}
