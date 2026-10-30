import { describe, expect, it } from 'vitest';
import { HostSession } from '../game/HostSession';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle, pieceAt } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { PROTOCOL_VERSION } from '../net/protocol';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
// The floor the bug was seen on (29 Oct): its fourth piece a fight room off a hall.
const spec: FloorSpec = { seed: 3183875831, pieces: 16, floor: 1, floors: 3 };

/** A floor with one hero, invulnerable so the test is about where the archers go, and archers in a room. */
function floor() {
  const world = buildWorld(floorLevel(spec));
  const host = new HostSession(world, () => {}, true);
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const me = host.sim.players[0];
  const layout = world.level.dungeon!;
  const room = layout.pieces.find((p) => layout.def.pieces[p.id].fight && p.id !== layout.def.exit)!;
  const mid = openMiddle(room);
  const archers = [-1.5, 1.5].map((dx) => {
    const e = createEnemy(host.sim, world, 'archer', mid.x + dx, mid.z, 0);
    // createEnemy puts it in the fight already.
    e.ai = 'chase';
    return e;
  });
  return { world, host, me, layout, room, archers };
}

describe('a fight room’s archers on a generated floor (found in play, 29 Oct)', () => {
  it('come after a hero who has left their sight, through the doorways, rather than drifting off', () => {
    const { host, me, layout, room, archers } = floor();
    // The hero stands two pieces away along the route, out of the room and out of sight, and waits.
    const far = layout.pieces.find((p) => p.id !== room.id && Math.abs(p.bounds.minX - room.bounds.minX) + Math.abs(p.bounds.minZ - room.bounds.minZ) > 20 && layout.def.pieces[p.id].sockets.some((sk) => sk.link >= 0))!;
    const spot = openMiddle(far);
    const start = archers.map((e) => Math.hypot(e.x - spot.x, e.z - spot.z));
    for (let i = 0; i < 60 * 25; i++) {
      Object.assign(me, { x: spot.x, z: spot.z, y: far.y, invulnTime: 10, hp: me.maxHp });
      host.tick();
    }
    for (const [i, e] of archers.entries()) {
      const d = Math.hypot(e.x - spot.x, e.z - spot.z);
      // Closer than they started, and within a bow's reach of the hero: never wandered off.
      expect(d).toBeLessThan(start[i]);
      expect(d).toBeLessThan(16);
      expect(pieceAt(layout, e.x, e.z)).not.toBe(-1);
    }
  });

  it('a grunt in another room goes through the doorways to its hero, not into the wall between', () => {
    const { world, host, me, layout, room } = floor();
    host.sim.enemies.length = 0;
    const mid = openMiddle(room);
    // Dead in line with the doorway, as a room's middle can be, behind the brazier that stands before it.
    const g = createEnemy(host.sim, world, 'grunt', mid.x, mid.z, 0);
    g.ai = 'chase';
    const far = layout.pieces.find((p) => p.id !== room.id && Math.abs(p.bounds.minX - room.bounds.minX) + Math.abs(p.bounds.minZ - room.bounds.minZ) > 20 && layout.def.pieces[p.id].sockets.some((sk) => sk.link >= 0))!;
    const spot = openMiddle(far);
    let closest = Infinity;
    for (let i = 0; i < 60 * 25; i++) {
      Object.assign(me, { x: spot.x, z: spot.z, invulnTime: 10, hp: me.maxHp });
      host.tick();
      closest = Math.min(closest, Math.hypot(g.x - me.x, g.z - me.z));
    }
    expect(closest).toBeLessThan(3);
  });

  it('back away from a hero who closes in, in any direction, not only along x', () => {
    const { host, me, archers, room } = floor();
    const e = archers[0];
    host.sim.enemies.splice(1);
    // The hero right above the archer (along z): the slice's ledge archer could only step along x.
    Object.assign(me, { x: e.x, z: e.z - 2, y: room.y, invulnTime: 10 });
    const z0 = e.z;
    for (let i = 0; i < 30; i++) {
      Object.assign(me, { x: e.x, z: e.z - 2, invulnTime: 10, hp: me.maxHp });
      host.tick();
    }
    expect(e.z).toBeGreaterThan(z0 + 0.3);
  });
});
