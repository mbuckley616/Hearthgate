import { describe, expect, it } from 'vitest';
import { addPlayer, type Loadout } from '../sim/coop';
import { emptyMods } from '../sim/gear';
import { stepDoors, stepPlayer } from '../sim/player';
import { emptyTalents } from '../sim/talents';
import { idleCommand, type PlayerState } from '../sim/types';
import { createSimState } from '../sim/world';
import { buildWorld } from './arena';
import { inDoor, TALK_RANGE, village } from './village';

const world = buildWorld(village);
const v = village.village!;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const DT = 1 / 60;

/** Walk at (x, z) until `done`, or give up after a few seconds; `interact` holds F the while. */
function walkAt(p: PlayerState, s: ReturnType<typeof createSimState>, x: number, z: number, done: () => boolean, interact = true) {
  for (let i = 0; i < 240 && !done(); i++) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const cmd = { ...idleCommand(), moveX: dx / d, moveZ: dz / d, aimX: dx / d, aimZ: dz / d, interact };
    stepPlayer(p, cmd, DT, world, s);
    stepDoors(s, world, { [p.id]: cmd });
  }
}

const press = (id: string) => ({ [id]: { ...idleCommand(), interact: true } });

describe('the buildings’ insides (interiors, Michael 28 Oct)', () => {
  // The doors come in pairs: a building's front door, then the way out of its inside.
  const pairs = v.interiors.map((r, i) => ({ r, into: v.doors[2 * i], out: v.doors[2 * i + 1] }));

  it.each(pairs.map((p) => [p.r.building, p]))('%s: in through its front door, its keeper in reach at the counter, and out again', (_name, { r, into, out }) => {
    const s = createSimState(village, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    const inside = () => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
    p.x = out.toX;
    p.z = out.toZ;
    walkAt(p, s, into.x, into.z, inside);
    expect(inside()).toBe(true);
    // The keeper stands behind their counter, and the counter's front is within talk.
    const keeper = v.villagers.find((n) => n.building === r.building)!;
    expect(keeper.x >= r.minX && keeper.x <= r.maxX && keeper.z >= r.minZ && keeper.z <= r.maxZ).toBe(true);
    walkAt(p, s, keeper.x, keeper.z, () => false);
    expect(Math.hypot(p.x - keeper.x, p.z - keeper.z)).toBeLessThan(TALK_RANGE);
    walkAt(p, s, out.x, out.z, () => !inside());
    expect(Math.hypot(p.x - out.toX, p.z - out.toZ)).toBeLessThan(1.5);
  });

  it('is the server’s to decide: a hero stepped alone (the browser’s prediction) never goes through', () => {
    const s = createSimState(village, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    const [into] = v.doors;
    p.x = into.x;
    p.z = into.z;
    stepPlayer(p, idleCommand(), DT, world, s);
    expect(Math.hypot(p.x - into.x, p.z - into.z)).toBeLessThan(1);
    stepDoors(s, world, press('p1'));
    expect(Math.hypot(p.x - into.toX, p.z - into.toZ)).toBeLessThan(0.01);
  });

  it.each(pairs.map((p) => [p.r.building, p]))('%s: a door takes a press (Michael, 29 Oct): walking into it, either side, goes nowhere', (_name, { r, into, out }) => {
    const s = createSimState(village, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    const inside = () => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
    p.x = out.toX;
    p.z = out.toZ;
    // Straight on through the door's circle, into the wall behind it.
    walkAt(p, s, 2 * into.x - out.toX, 2 * into.z - out.toZ, () => false, false);
    expect(Math.hypot(p.x - into.x, p.z - into.z)).toBeLessThan(into.radius);
    expect(inside()).toBe(false);
    expect(s.events.some((e) => e.kind === 'door')).toBe(false);
    // F there: through, with the door's sound for the browsers.
    stepDoors(s, world, press('p1'));
    expect(inside()).toBe(true);
    expect(s.events).toContainEqual(expect.objectContaining({ kind: 'door', playerId: 'p1' }));
    // Inside, the doorway is shut: walking on at it stops in its circle and stays in.
    walkAt(p, s, r.doorX, r.maxZ + 3, () => false, false);
    expect(inside()).toBe(true);
    expect(Math.hypot(p.x - out.x, p.z - out.z)).toBeLessThan(out.radius);
  });

  it('brings a player’s henchmen through a door with them, side by side and clear of the doors', () => {
    const s = createSimState(village, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    const hench = ['h1', 'h2', 'h3'].map((id) => Object.assign(addPlayer(s, world, id, loadout, false), { henchman: true }));
    const [into] = v.doors;
    hench.forEach((h, i) => Object.assign(h, { x: into.x + i - 1, z: into.z + 3 }));
    p.x = into.x;
    p.z = into.z;
    stepDoors(s, world, press('p1'));
    expect(Math.hypot(p.x - into.toX, p.z - into.toZ)).toBeLessThan(0.01);
    for (const h of hench) {
      expect(Math.hypot(h.x - into.toX, h.z - into.toZ)).toBeLessThan(2);
      for (const d of v.doors) expect(inDoor(d, h.x, h.z)).toBe(false);
      for (const o of [p, ...hench]) if (o !== h) expect(Math.hypot(h.x - o.x, h.z - o.z)).toBeGreaterThan(0.8);
    }
  });

  it('never lands a hero in a door circle, so nobody bounces back', () => {
    for (const d of v.doors) for (const e of v.doors) expect(inDoor(e, d.toX, d.toZ)).toBe(false);
  });

  it('takes F anywhere along the shrine’s broad door, not only its middle (the critic, 30 Oct)', () => {
    const [into] = v.doors;
    for (const x of [-1.1, -0.6, 0, 0.6, 1.1]) {
      const s = createSimState(village, [], world);
      const p = addPlayer(s, world, 'p1', loadout, false);
      p.x = x;
      p.z = -13.6;
      // North into the planks, pressing F the while: the hero stops against the wall and goes through.
      walkAt(p, s, x, -16, () => p.z < -60);
      expect(Math.hypot(p.x - into.toX, p.z - into.toZ)).toBeLessThan(0.01);
    }
    // Past the drawn door's edge (1.1 m) and a hero's width beyond, the wall is only a wall.
    expect(inDoor(into, 1.6, -14.6)).toBe(false);
    expect(inDoor(into, 0, -13.6)).toBe(false);
  });

  it('keeps every inside apart from the square and from each other', () => {
    const h = village.floorSize / 2;
    for (const r of v.interiors) expect(Math.max(Math.abs(r.minX), Math.abs(r.maxX), Math.abs(r.minZ), Math.abs(r.maxZ))).toBeGreaterThan(h + 40);
    for (const a of v.interiors) for (const b of v.interiors) if (a !== b) expect(a.maxX < b.minX - 20 || b.maxX < a.minX - 20 || a.maxZ < b.minZ - 20 || b.maxZ < a.minZ - 20).toBe(true);
  });
});
