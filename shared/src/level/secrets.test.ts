import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { addPlayer, type Loadout } from '../sim/coop';
import { floorWorldNow, stepFloorRun } from '../sim/floorRun';
import { createEnemy } from '../sim/enemies';
import { emptyMods, xpForLevel } from '../sim/gear';
import { stepPlayer } from '../sim/player';
import { smashArc } from '../sim/smash';
import { emptyTalents } from '../sim/talents';
import { idleCommand, type PlayerCommand } from '../sim/types';
import { createSimState } from '../sim/world';
import { buildWorld } from './arena';
import { floorLevel, insidePiece } from './floor';
import { resolveCircle } from './geometry';
import { SIDE_DIR } from './kit';
import { SECRET_ID_BASE, TREASURE_ID_BASE, mainWay, secretOf } from './secrets';

// G5's C, secrets (Michael's A, 5 Nov): now and then a fight room's walled-up doorway is a cracked
// wall with a one-cell room and a chest behind it; a heavy hit, a bash or a slam breaks the wall.

function secretFloor() {
  for (let seed = 1; seed < 400; seed++) {
    const level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
    const layout = level.dungeon!;
    if (!layout.secrets.length) continue;
    const world = buildWorld(level);
    const state = createSimState(level, [], world);
    const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
    const p = addPlayer(state, world, 'p1', l, false);
    p.style = 'sword';
    const sr = layout.secrets[0];
    // Facing the crack from 1.2 m into the room.
    const dir = SIDE_DIR[sr.side];
    Object.assign(p, { x: sr.x - dir.x * 1.2, z: sr.z - dir.z * 1.2, y: sr.y, grounded: true, yaw: Math.atan2(dir.x, dir.z) });
    return { level, layout, world, state, p, sr, dir };
  }
  throw new Error('no secret in 400 seeds');
}

/** Swing once, a tap or a held heavy, facing the crack, until the hero is back on their feet. */
function swing(f: ReturnType<typeof secretFloor>, heavy: boolean) {
  const holdTicks = heavy ? Math.ceil(((tuning.combo.heavyHoldMs + 60) / 1000) * 60) : 2;
  for (let t = 0; t < 240; t++) {
    const cmd: PlayerCommand = { ...idleCommand(), aimX: f.dir.x, aimZ: f.dir.z, attack: t === 0, attackHeld: t < holdTicks };
    stepPlayer(f.p, cmd, 1 / 60, floorWorldNow(f.world, f.state), f.state);
    f.state.time += 1 / 60;
    if (t > holdTicks && f.p.mode === 'move') break;
  }
}

describe('secret rooms behind cracked walls (G5)', () => {
  it('turn up now and then, behind a fight room, in a clear cell inside the floor, the same every time', () => {
    let secrets = 0;
    let floors = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const spec = { seed, pieces: 24, floor: 1, floors: 3 };
      const layout = floorLevel(spec).dungeon!;
      expect(floorLevel(spec).dungeon!.secrets).toEqual(layout.secrets);
      if (layout.secrets.length) floors++;
      secrets += layout.secrets.length;
      expect(layout.secrets.length).toBeLessThanOrEqual(2);
      for (const sr of layout.secrets) {
        const room = layout.pieces[sr.piece];
        expect(room.fight).toBe(true);
        expect(room.kind).not.toBe('boss');
        // The crack is on one of the room's walled-up doorways, and the cell overlaps no piece.
        expect(room.doors.some((d) => !d.open && d.x === sr.x && d.z === sr.z)).toBe(true);
        for (const p of layout.pieces) {
          const c = sr.cell;
          const b = p.bounds;
          expect(c.minX >= b.maxX - 1e-6 || b.minX >= c.maxX - 1e-6 || c.minZ >= b.maxZ - 1e-6 || b.minZ >= c.maxZ - 1e-6).toBe(true);
        }
        expect(sr.cell.minX).toBeGreaterThanOrEqual(layout.bounds.minX - 1e-6);
        expect(sr.cell.maxZ).toBeLessThanOrEqual(layout.bounds.maxZ + 1e-6);
        expect(insidePiece(room, sr.crack.x, sr.crack.z)).toBe(true);
        expect(secretOf(sr.crack.id)).toEqual({ secret: sr.id, crack: true });
        expect(secretOf(sr.chest.id)).toEqual({ secret: sr.id, crack: false });
        expect(layout.smashable).toContain(sr.chest);
      }
      for (const pr of layout.props) expect(pr.id).toBeLessThan(SECRET_ID_BASE);
    }
    // "Now and then": on a fair share of floors, not every one.
    expect(floors).toBeGreaterThan(20);
    expect(floors).toBeLessThan(90);
    expect(secrets).toBeGreaterThan(floors - 1);
  });

  it('is a wall until a heavy breaks it: a light swing does not, a heavy does, and then the cell is open', () => {
    const f = secretFloor();
    const wallUp = () => floorWorldNow(f.world, f.state).colliders.some((c) => c.id === f.sr.wall.id);
    expect(wallUp()).toBe(true);
    // Nobody walks through it.
    const into = resolveCircle({ x: f.sr.x, z: f.sr.z }, tuning.movement.radius, f.sr.y, f.sr.y + 1.8, floorWorldNow(f.world, f.state).colliders);
    expect(Math.hypot(into.x - f.sr.x, into.z - f.sr.z)).toBeGreaterThan(0.2);
    swing(f, false);
    expect(f.state.floor!.broken).not.toContain(f.sr.crack.id);
    expect(wallUp()).toBe(true);
    swing(f, true);
    expect(f.state.floor!.broken).toContain(f.sr.crack.id);
    expect(f.state.events).toContainEqual(expect.objectContaining({ kind: 'smashed', propKind: 'crack', coin: 0 }));
    expect(wallUp()).toBe(false);
    // Through the gap and into the cell.
    const gap = resolveCircle({ x: f.sr.x, z: f.sr.z }, tuning.movement.radius, f.sr.y, f.sr.y + 1.8, floorWorldNow(f.world, f.state).colliders);
    expect(Math.hypot(gap.x - f.sr.x, gap.z - f.sr.z)).toBeLessThan(1e-6);
    const mid = { x: (f.sr.inner.minX + f.sr.inner.maxX) / 2, z: (f.sr.inner.minZ + f.sr.inner.maxZ) / 2 };
    const cell = resolveCircle({ ...mid }, tuning.movement.radius, f.sr.y, f.sr.y + 1.8, floorWorldNow(f.world, f.state).colliders);
    expect(Math.hypot(cell.x - mid.x, cell.z - mid.z)).toBeLessThan(1e-6);
  });

  it("breaks to a shield's bash but not to a whirlwind or a burst", () => {
    const f = secretFloor();
    smashArc(f.state, f.layout.smashable, f.p, f.p.x, f.p.z, 2, 360);
    expect(f.state.floor!.broken).not.toContain(f.sr.crack.id);
    smashArc(f.state, f.layout.smashable, f.p, f.p.x, f.p.z, tuning.abilities.bashRangeM, tuning.abilities.bashArcDeg, true);
    expect(f.state.floor!.broken).toContain(f.sr.crack.id);
  });

  it('holds a chest that breaks to any blow and sprays a find inside the cell, coin always', () => {
    const f = secretFloor();
    const ch = f.sr.chest;
    Object.assign(f.p, { x: ch.x - f.dir.x * 1.2, z: ch.z - f.dir.z * 1.2, yaw: Math.atan2(f.dir.x, f.dir.z) });
    smashArc(f.state, f.layout.smashable, f.p, f.p.x, f.p.z, 1.6, 120);
    expect(f.state.floor!.broken).toContain(ch.id);
    const ev = f.state.events.find((e) => e.kind === 'smashed' && e.propKind === 'chest');
    expect(ev).toBeDefined();
    if (ev?.kind !== 'smashed') return;
    expect(ev.coin).toBeGreaterThanOrEqual(tuning.loop.chestCoinMin);
    expect(ev.lumber).toBeGreaterThanOrEqual(tuning.loop.chestLumberMin);
    const loot = f.state.floor!.loot!.filter((d) => Math.floor(d.id / 8) === ch.id);
    expect(loot.reduce((n, d) => n + (d.kind === 'coin' ? d.amount : 0), 0)).toBe(ev.coin);
    for (const d of loot) {
      expect(d.x).toBeGreaterThanOrEqual(f.sr.inner.minX);
      expect(d.x).toBeLessThanOrEqual(f.sr.inner.maxX);
      expect(d.z).toBeGreaterThanOrEqual(f.sr.inner.minZ);
      expect(d.z).toBeLessThanOrEqual(f.sr.inner.maxZ);
    }
  });
});

describe('treasure rooms (G5)', () => {
  it('hang off a hall on the main way, behind a fight room still ahead, on about half the floors', () => {
    let floors = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const spec = { seed, pieces: 24, floor: 1, floors: 3 };
      const layout = floorLevel(spec).dungeon!;
      expect(floorLevel(spec).dungeon!.treasure).toEqual(layout.treasure);
      expect(layout.treasure.length).toBeLessThanOrEqual(1);
      for (const t of layout.treasure) {
        floors++;
        const way = mainWay(layout.def);
        const hall = layout.pieces[t.piece];
        expect(way).toContain(t.piece);
        expect(['small', 'medium', 'large', 'boss', 'rest', 'entrance', 'stair']).not.toContain(hall.kind);
        expect(hall.fight).toBe(false);
        // Its key is the first fight room after the hall on the way.
        const after = way.slice(way.indexOf(t.piece) + 1);
        expect(after.find((id) => layout.pieces[id].fight && layout.pieces[id].kind !== 'boss')).toBe(t.key);
        for (const p of layout.pieces) {
          const c = t.cell;
          const b = p.bounds;
          expect(c.minX >= b.maxX - 1e-6 || b.minX >= c.maxX - 1e-6 || c.minZ >= b.maxZ - 1e-6 || b.minZ >= c.maxZ - 1e-6).toBe(true);
        }
        for (const sr of layout.secrets) {
          const c = t.cell;
          const b = sr.cell;
          expect(c.minX >= b.maxX - 1e-6 || b.minX >= c.maxX - 1e-6 || c.minZ >= b.maxZ - 1e-6 || b.minZ >= c.maxZ - 1e-6).toBe(true);
        }
        expect(t.chest.id).toBe(TREASURE_ID_BASE);
        expect(secretOf(t.chest.id)).toBeNull();
        expect(layout.smashable).toContain(t.chest);
      }
    }
    expect(floors).toBeGreaterThan(25);
    expect(floors).toBeLessThan(75);
  });

  it('keeps its portcullis down until its key room is cleared, then the room and its chest are open', () => {
    let seed = 1;
    let level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
    while (!level.dungeon!.treasure.length) level = floorLevel({ seed: ++seed, pieces: 24, floor: 1, floors: 3 });
    const t = level.dungeon!.treasure[0];
    const world = buildWorld(level);
    const state = createSimState(level, [], world);
    const gateDown = () => floorWorldNow(world, state).colliders.some((c) => c === t.gate);
    expect(gateDown()).toBe(true);
    const shut = resolveCircle({ x: t.x, z: t.z }, tuning.movement.radius, t.y, t.y + 1.8, floorWorldNow(world, state).colliders);
    expect(Math.hypot(shut.x - t.x, shut.z - t.z)).toBeGreaterThan(0.2);
    state.floor!.cleared.push(t.key);
    expect(gateDown()).toBe(false);
    const open = resolveCircle({ x: t.x, z: t.z }, tuning.movement.radius, t.y, t.y + 1.8, floorWorldNow(world, state).colliders);
    expect(Math.hypot(open.x - t.x, open.z - t.z)).toBeLessThan(1e-6);
    const mid = { x: (t.inner.minX + t.inner.maxX) / 2, z: (t.inner.minZ + t.inner.maxZ) / 2 };
    const inside = resolveCircle({ ...mid }, tuning.movement.radius, t.y, t.y + 1.8, floorWorldNow(world, state).colliders);
    expect(Math.hypot(inside.x - mid.x, inside.z - mid.z)).toBeLessThan(1e-6);
    const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
    const p = addPlayer(state, world, 'p1', l, false);
    const dir = SIDE_DIR[t.side];
    Object.assign(p, { x: t.chest.x - dir.x * 1.2, z: t.chest.z - dir.z * 1.2, y: t.y, yaw: Math.atan2(dir.x, dir.z) });
    smashArc(state, level.dungeon!.smashable, p, p.x, p.z, 1.6, 120);
    expect(state.floor!.broken).toContain(t.chest.id);
    for (const d of state.floor!.loot ?? []) {
      expect(d.x).toBeGreaterThanOrEqual(t.inner.minX);
      expect(d.x).toBeLessThanOrEqual(t.inner.maxX);
      expect(d.z).toBeGreaterThanOrEqual(t.inner.minZ);
      expect(d.z).toBeLessThanOrEqual(t.inner.maxZ);
    }
  });

  it('wakes its guard once a player steps into the opened room: a crowned elite by the chest and its pack', () => {
    let seed = 1;
    let level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
    while (!level.dungeon!.treasure.length) level = floorLevel({ seed: ++seed, pieces: 24, floor: 1, floors: 3 });
    const t = level.dungeon!.treasure[0];
    const world = buildWorld(level);
    const state = createSimState(level, [], world);
    const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
    const p = addPlayer(state, world, 'p1', l, false);
    const mid = { x: (t.inner.minX + t.inner.maxX) / 2, z: (t.inner.minZ + t.inner.maxZ) / 2 };
    const guards = () => state.enemies.filter((e) => e.guard === t.id);
    const step = () => stepFloorRun(state, 1 / 60, floorWorldNow(world, state));
    // Out in the hall, nothing.
    Object.assign(p, { x: t.x - SIDE_DIR[t.side].x * 3, z: t.z - SIDE_DIR[t.side].z * 3, y: t.y });
    state.floor!.cleared.push(t.key);
    step();
    expect(guards().length).toBe(0);
    // In the room before its key room fell (as if through the gate), nothing either.
    state.floor!.cleared = [];
    Object.assign(p, mid);
    step();
    expect(guards().length).toBe(0);
    // Opened and stepped into: the elite and its pack, once.
    state.floor!.cleared.push(t.key);
    step();
    step();
    const g = guards();
    expect(g.length).toBe(1 + tuning.miniboss.guardPack);
    const lead = g.find((e) => e.named)!;
    expect(lead).toBeDefined();
    expect(['knight', 'brute']).toContain(lead.kind);
    const plain = createEnemy(createSimState(level, [], world), world, lead.kind, mid.x, mid.z, 0);
    expect(lead.maxHp).toBeCloseTo(plain.maxHp * tuning.miniboss.guardHealthMult, 5);
    expect(g.filter((e) => !e.named).every((e) => e.kind === 'grunt')).toBe(true);
    for (const e of g) {
      expect(e.x).toBeGreaterThan(t.inner.minX);
      expect(e.x).toBeLessThan(t.inner.maxX);
      expect(e.z).toBeGreaterThan(t.inner.minZ);
      expect(e.z).toBeLessThan(t.inner.maxZ);
    }
    expect(Math.hypot(lead.x - t.chest.x, lead.z - t.chest.z)).toBeLessThan(3);
    // A guard that follows the party does not hold a fight room open.
    const room = level.dungeon!.pieces.find((r) => r.fight && r.kind !== 'boss' && r.id !== t.key)!;
    Object.assign(state.run, { phase: 'wave', reinforced: true, waveSize: 1 });
    state.floor!.room = room.id;
    step();
    expect(state.floor!.cleared).toContain(room.id);
    expect(guards().length).toBe(1 + tuning.miniboss.guardPack);
  });

  it('wakes no guard with the switch off', () => {
    const kept = tuning.miniboss.treasureGuard;
    tuning.miniboss.treasureGuard = false;
    try {
      let seed = 1;
      let level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
      while (!level.dungeon!.treasure.length) level = floorLevel({ seed: ++seed, pieces: 24, floor: 1, floors: 3 });
      const t = level.dungeon!.treasure[0];
      const world = buildWorld(level);
      const state = createSimState(level, [], world);
      const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
      const p = addPlayer(state, world, 'p1', l, false);
      Object.assign(p, { x: (t.inner.minX + t.inner.maxX) / 2, z: (t.inner.minZ + t.inner.maxZ) / 2 });
      state.floor!.cleared.push(t.key);
      stepFloorRun(state, 1 / 60, floorWorldNow(world, state));
      expect(state.enemies.length).toBe(0);
    } finally {
      tuning.miniboss.treasureGuard = kept;
    }
  });
});
