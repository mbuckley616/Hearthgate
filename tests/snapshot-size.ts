// How big a snapshot is in a crowd (Session 86's setup, kept so the number can be taken again): the
// arena, one hero, three henchmen (sword, bow, staff), 55 enemies placed round the hero (Session 86
// had 24 placed and the waves, 55 at its peak), god mode on so the hero stands. Prints the snapshot's JSON size as the room sends it,
// what each part of the state costs, and which enemy and player fields weigh most; as JSON, as
// msgpack the way Colyseus sends it, and (since the snapshot-size card) as the rows net/pack.ts sends.
// `npx tsx tests/snapshot-size.ts` (add `--fields` for the per-field table).
import { Packr } from '@colyseus/msgpackr';
import { tuning } from '@hearthgate/shared/config/tuning';
import { HostSession } from '@hearthgate/shared/game/HostSession';
import { arena, buildWorld } from '@hearthgate/shared/level/arena';
import { fromWire, toWire } from '@hearthgate/shared/net/pack';
import { PROTOCOL_VERSION, type ToPeer } from '@hearthgate/shared/net/protocol';
import { createEnemy } from '@hearthgate/shared/sim/enemies';
import { emptyMods } from '@hearthgate/shared/sim/gear';
import { emptyTalents } from '@hearthgate/shared/sim/talents';
import type { EnemyKind } from '@hearthgate/shared/config/tuning';
import { idleCommand } from '@hearthgate/shared/sim/types';

// As Colyseus packs a message (@colyseus/core's Protocol): what actually crosses the wire.
const packr = new Packr({ useRecords: false });
const mp = (v: unknown) => packr.pack(v).byteLength;

const world = buildWorld(arena);
const snaps: Extract<ToPeer, { k: 'snap' }>[] = [];
const host = new HostSession(world, (m) => {
  if (m.k === 'snap') snaps.push(m);
}, true);
tuning.debug.godMode = true;

host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout: { name: 'Alpha', xp: { sword: 4000, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 } });
for (let i = 0; i < 3; i++) host.onMessage('a', { k: 'cheat', cheat: 'henchman' });
const me = host.sim.players.find((p) => !p.henchman)!;
const kinds: EnemyKind[] = ['grunt', 'grunt', 'archer', 'brute', 'shieldbearer', 'hound', 'priest', 'knight', 'wraith'];
for (let i = 0; i < 55; i++) {
  const a = (i / 55) * Math.PI * 2 * 3;
  const r = 5 + (i % 5) * 2.5;
  createEnemy(host.sim, world, kinds[i % kinds.length], me.x + Math.sin(a) * r, me.z + Math.cos(a) * r, a + Math.PI);
}

let seq = 0;
const sizes: number[] = [];
let crowd = 0;
let peak = 0;
let heaviest: (typeof snaps)[number] | undefined;
const CROWD = 40;
const wireBefore: number[] = [];
const wireAfter: number[] = [];
for (let t = 0; t < 1200; t++) {
  seq++;
  host.onMessage('a', { k: 'input', cmds: [{ seq, cmd: { ...idleCommand(), attack: t % 20 === 0 } }] });
  const before = snaps.length;
  host.tick();
  if (snaps.length > before) {
    const m = snaps[snaps.length - 1];
    const live = m.s.enemies.filter((e) => e.ai !== 'dead').length;
    peak = Math.max(peak, live);
    if (live >= CROWD) {
      sizes.push(JSON.stringify(m).length);
      wireBefore.push(mp(m));
      wireAfter.push(mp(toWire(m)));
      crowd = Math.max(crowd, m.s.enemies.length);
      if (!heaviest || JSON.stringify(m).length > JSON.stringify(heaviest).length) heaviest = m;
    }
  }
}

const last = heaviest ?? snaps[snaps.length - 1];
sizes.sort((a, b) => a - b);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`peak ${peak} live enemies; snapshots with ${CROWD}+ live: ${sizes.length}, up to ${crowd} enemies (live and dead)`);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0;
console.log(`as JSON: median ${kb(med(sizes))}, max ${kb(Math.max(...sizes))}`);
console.log(`on the wire (msgpack): median ${kb(med(wireBefore))}, max ${kb(Math.max(...wireBefore))}; packed rows: median ${kb(med(wireAfter))}, max ${kb(Math.max(...wireAfter))}`);
const s = last.s;
const part = (v: unknown) => JSON.stringify(v).length;
console.log(`last: ${kb(part(last))}; enemies ${s.enemies.length} ${kb(part(s.enemies))}, players ${s.players.length} ${kb(part(s.players))}, projectiles ${s.projectiles.length} ${kb(part(s.projectiles))}, drops ${s.drops.length} ${kb(part(s.drops))}, the rest ${kb(part(last) - part(s.enemies) - part(s.players) - part(s.projectiles) - part(s.drops))}`);
for (const p of s.players) console.log(`  ${p.id}${p.henchman ? ' (henchman)' : ''}: ${kb(part(p))}`);

if (process.argv.includes('--fields')) {
  const weigh = (rows: object[]) => {
    const w: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(r)) w[k] = (w[k] ?? 0) + k.length + 3 + JSON.stringify(v).length;
    return Object.entries(w).sort((a, b) => b[1] - a[1]);
  };
  console.log('enemy fields (bytes over all enemies):');
  for (const [k, n] of weigh(s.enemies)) console.log(`  ${k.padEnd(16)} ${n}`);
  console.log('player fields (bytes over all players):');
  for (const [k, n] of weigh(s.players)) console.log(`  ${k.padEnd(16)} ${n}`);
}
console.log(`rest: pendingHits ${kb(part(s.pendingHits))}, events ${last.ev.length} ${kb(part(last.ev))}, run ${kb(part(s.run))}, portals ${kb(part(last.portals))}`);

const w = toWire(last) as { p: { enemies: unknown; players: unknown; projectiles: unknown } };
console.log(`rows (after): whole ${kb(mp(w))}, enemies ${kb(mp(w.p.enemies))}, players ${kb(mp(w.p.players))}, projectiles ${kb(mp(w.p.projectiles))}`);
console.log(`keyed (before): whole ${kb(mp(last))}, enemies ${kb(mp(s.enemies))}, players ${kb(mp(s.players))}, projectiles ${kb(mp(s.projectiles))}, events ${kb(mp(last.ev))}`);
const t0 = performance.now();
for (const m of snaps) fromWire(toWire(m));
console.log(`pack and unpack: ${((performance.now() - t0) / snaps.length).toFixed(3)} ms a snapshot`);
