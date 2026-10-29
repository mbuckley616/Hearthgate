import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { partyOnPortal } from '../game/portal';
import { arena, buildWorld } from '../level/arena';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readToHost } from '../net/validate';
import { spawnDrop } from './drops';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { henchmanCommand, inTelegraph } from './henchman';
import { emptyTalents } from './talents';
import type { SimEvent } from './types';

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const world = buildWorld(arena);

/** The arena with one player standing back and a henchman beside the spot the grunts come to. */
function party() {
  const host = new HostSession(world, () => {}, true);
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const me = host.sim.players[0];
  const h = host.addHenchman(me)!;
  me.x = 0;
  me.z = 16;
  h.x = 0;
  h.z = 0;
  return { host, me, h };
}

describe('a henchman (P3)', () => {
  it('fights on its own: closes on grunts, chains on them and kills them, and takes hits a player would dodge', () => {
    const { host, h } = party();
    const grunts = [-2, 0, 2].map((dx) => {
      const e = createEnemy(host.sim, world, 'grunt', h.x + dx, h.z - 6, 0);
      e.ai = 'chase';
      host.sim.enemies.push(e);
      return e;
    });
    const events: SimEvent[] = [];
    // (Standing in the arena also starts the slice's waves: it fights those too.)
    for (let i = 0; i < 60 * 40 && grunts.some((e) => e.ai !== 'dead'); i++) events.push(...host.tick());
    const kills = events.filter((e) => e.kind === 'hit' && e.attackerId === h.id && e.killed).length;
    expect(grunts.every((e) => e.ai === 'dead')).toBe(true);
    expect(kills).toBeGreaterThanOrEqual(3);
    expect(events.some((e) => e.kind === 'heroHurt' && e.playerId === h.id)).toBe(true);
    expect(h.mode).not.toBe('down');
  });

  it('reads a telegraph only after reactMs, then answers it once', () => {
    const { host, h } = party();
    const e = createEnemy(host.sim, world, 'grunt', h.x, h.z - 1.5, 0);
    host.sim.enemies.push(e);
    e.ai = 'windup';
    e.tele = { shape: 'circle', x: h.x, z: h.z - 0.8, radius: 1.2, yaw: 0, arcDeg: 360 };
    expect(inTelegraph(e, h.x, h.z)).toBe(true);
    const first = henchmanCommand(host.sim, h);
    expect(first.dodge || first.block).toBe(false);
    host.sim.time += tuning.hirelings.reactMs / 1000 + 0.01;
    const later = henchmanCommand(host.sim, h);
    expect(later.dodge || later.block).toBe(true);
    if (later.dodge) expect(later.moveZ).toBeGreaterThan(0);
    // Answered: the same telegraph is not dodged twice.
    expect(henchmanCommand(host.sim, h).dodge).toBe(false);
  });

  it('is passed by when the party takes a ring and when loot drops, and fills a party slot', () => {
    const { host, me, h } = party();
    const ring = { x: me.x, z: me.z, radius: 2 };
    expect(partyOnPortal(host.sim, ring)).toBe(true);
    spawnDrop(host.sim, world, 0, 0, false);
    expect(host.sim.drops.map((d) => d.owner)).toEqual([me.id]);
    expect(h.name).toBe('Garrick');
    for (let i = 0; i < tuning.coop.maxPlayers; i++) host.addHenchman(me);
    expect(host.sim.players).toHaveLength(tuning.coop.maxPlayers);
    expect(readToHost({ k: 'cheat', cheat: 'henchman' })).toEqual({ k: 'cheat', cheat: 'henchman' });
  });
});
