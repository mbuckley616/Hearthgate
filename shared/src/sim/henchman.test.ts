import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { partyOnPortal } from '../game/portal';
import { arena, buildWorld } from '../level/arena';
import { village } from '../level/village';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readToHost } from '../net/validate';
import { spawnDrop } from './drops';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { henchmanCommand, inTelegraph, readHenchmanCards } from './henchman';
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

describe('the tavern’s henchmen (P10)', () => {
  it('travel as cards: name, kit, level and quickness, out of one room and into the next', () => {
    const a = party();
    a.host.addHenchman(a.me, 'staff', { quick: true });
    const cards = a.host.takeHenchmen();
    expect(a.host.sim.players.some((p) => p.henchman)).toBe(false);
    expect(cards.map((c) => [c.name, c.style, c.quick ?? false])).toEqual([
      ['Garrick', 'sword', false],
      ['Tamsin', 'staff', true],
    ]);
    const b = party();
    b.host.takeHenchmen();
    b.host.receiveHenchmen(readHenchmanCards(JSON.parse(JSON.stringify(cards))));
    expect(b.host.sim.players.filter((p) => p.henchman).map((p) => [p.name, p.style, !!p.brain?.quick])).toEqual([
      ['Garrick', 'sword', false],
      ['Tamsin', 'staff', true],
    ]);
  });

  it('give their slot to a friend who joins a full party; a party of players stays full', () => {
    const { host, me } = party();
    host.addHenchman(me);
    host.addHenchman(me);
    expect(host.sim.players).toHaveLength(4);
    host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    expect(host.sim.players).toHaveLength(4);
    expect(host.sim.players.filter((p) => p.henchman)).toHaveLength(2);
    expect(host.sim.players.some((p) => p.name === 'p' && p.id !== me.id)).toBe(true);
  });

  it('hired together on one spot, they step apart rather than stand as one figure', () => {
    const { host, me, h } = party();
    const more = [host.addHenchman(me)!, host.addHenchman(me)!];
    for (const o of more) {
      o.x = h.x;
      o.z = h.z;
    }
    for (let i = 0; i < 240; i++) host.tick();
    const hench = [h, ...more];
    for (const a of hench) for (const b of hench) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1);
    // And still with the party.
    for (const a of hench) expect(Math.hypot(a.x - me.x, a.z - me.z)).toBeLessThan(tuning.hirelings.followDistance + 2);
  });

  it('stuck behind a counter it walks straight into, it is put beside its player after stuckMs, and not before', () => {
    const host = new HostSession(buildWorld(village), () => {}, true);
    host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    const me = host.sim.players[0];
    const h = host.addHenchman(me)!;
    // The tavern: the player before the bar, the henchman behind it between the bar and the kegs.
    Object.assign(me, { x: 0, z: 80 });
    Object.assign(h, { x: 0, z: 73.8 });
    const ticks = (ms: number) => Math.round((ms / 1000) * tuning.sim.tickRate);
    for (let i = 0; i < ticks(tuning.hirelings.stuckMs * 0.8); i++) host.tick();
    expect(h.z).toBeLessThan(75.55);
    for (let i = 0; i < ticks(tuning.hirelings.stuckMs * 0.5); i++) host.tick();
    expect(Math.hypot(h.x - me.x, h.z - me.z)).toBeLessThan(tuning.hirelings.spacing + 0.5);
  });

  it('a bow henchman standing to shoot is never taken for stuck', () => {
    const { host, me, h } = party();
    host.sim.players.splice(host.sim.players.indexOf(h), 1);
    const bow = host.addHenchman(me, 'bow')!;
    Object.assign(bow, { x: 0, z: 0 });
    for (const dx of [-2, 0, 2]) host.sim.enemies.push(createEnemy(host.sim, world, 'grunt', dx, -9, 0));
    const at: number[] = [];
    for (let i = 0; i < 300; i++) {
      host.tick();
      at.push(Math.hypot(bow.x - me.x, bow.z - me.z));
    }
    // Never jumps to the player's side mid-fight.
    expect(Math.min(...at)).toBeGreaterThan(tuning.hirelings.spacing + 0.5);
  });

  it('a top tier’s hire reads a telegraph quicker', () => {
    const { host, me } = party();
    host.takeHenchmen();
    const quick = host.addHenchman(me, 'sword', { quick: true })!;
    quick.x = 0;
    quick.z = 0;
    const e = createEnemy(host.sim, world, 'grunt', 0, -1.5, 0);
    host.sim.enemies.push(e);
    e.ai = 'windup';
    e.tele = { shape: 'circle', x: 0, z: -0.8, radius: 1.2, yaw: 0, arcDeg: 360 };
    henchmanCommand(host.sim, quick);
    host.sim.time += (tuning.hirelings.reactMs * tuning.hirelings.quickReact) / 1000 + 0.01;
    const later = henchmanCommand(host.sim, quick);
    expect(later.dodge || later.block).toBe(true);
    expect(readToHost({ k: 'hire', kit: 'bow', coin: 70 })).toEqual({ k: 'hire', kit: 'bow', coin: 70 });
    expect(readToHost({ k: 'hire', kit: 'axe', coin: 70 })).toBeNull();
    expect(readToHost({ k: 'dismiss', kit: 'staff' })).toEqual({ k: 'dismiss', kit: 'staff' });
  });
});

describe('the bow and staff henchmen (P6)', () => {
  it('come in turn: a sword, a bow, a staff', () => {
    const { host, me } = party();
    host.addHenchman(me);
    host.addHenchman(me);
    expect(host.sim.players.filter((p) => p.henchman).map((p) => p.style)).toEqual(['sword', 'bow', 'staff']);
  });

  it('keep to their range: step back from a grunt in their face, close on one far off, shoot one in range', () => {
    const host = new HostSession(world, () => {}, true);
    host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    const me = host.sim.players[0];
    const bow = host.addHenchman(me, 'bow')!;
    bow.x = 0;
    bow.z = 0;
    me.x = 0;
    me.z = 2;
    const e = createEnemy(host.sim, world, 'grunt', 0, -2, 0);
    e.ai = 'chase';
    host.sim.enemies.push(e);
    const near = henchmanCommand(host.sim, bow);
    expect(near.moveZ).toBeGreaterThan(0.5);
    e.z = -11.5;
    const far = henchmanCommand(host.sim, bow);
    expect(far.moveZ).toBeLessThan(-0.5);
    e.z = -8;
    let shot = false;
    for (let t = 0; t < 30; t++) {
      host.sim.tick++;
      const cmd = henchmanCommand(host.sim, bow);
      expect(Math.hypot(cmd.moveX, cmd.moveZ)).toBeLessThan(0.01);
      shot ||= cmd.attack;
    }
    expect(shot).toBe(true);
  });

  it('revive a downed player when nothing threatens them', () => {
    const { host, me, h } = party();
    me.mode = 'down';
    me.hp = 0;
    me.bleed = 25;
    me.downTime = 99;
    h.x = me.x + 3;
    h.z = me.z;
    for (let i = 0; i < 60 * 8 && me.mode === 'down'; i++) host.tick();
    expect(me.mode).toBe('move');
  });

  it('three of them pay off a combo in a fight (the gate)', () => {
    const { host, me } = party();
    host.addHenchman(me);
    host.addHenchman(me);
    const hench = host.sim.players.filter((p) => p.henchman);
    for (const h of hench) {
      h.x = me.x + (hench.indexOf(h) - 1) * 2;
      h.z = me.z - 4;
    }
    for (const dx of [-3, -1, 1, 3]) {
      const e = createEnemy(host.sim, world, dx === 1 ? 'brute' : 'grunt', me.x + dx, me.z - 12, 0);
      e.ai = 'chase';
      host.sim.enemies.push(e);
    }
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 * 60; i++) events.push(...host.tick());
    const combos = events.filter((e) => e.kind === 'combo' && hench.some((h) => h.id === e.playerId));
    expect(combos.length).toBeGreaterThan(0);
  });
});
