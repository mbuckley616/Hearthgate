/**
 * The boss bench (B0, `docs/bosses.md` section 3; Michael's A on the boss document, 16 Nov): scripted
 * heroes against a named boss on its story floor at Normal, headless, so 1.2's bar (solo in 3 to 5
 * minutes, a duo in under half that) is a number and not a feeling. It steps a `HostSession` directly,
 * as `tests/snapshot-size.ts` does: every hero is a player sending numbered commands a keyboard could
 * send, through the same input slots and sim the server runs, with no network and no cheats (god mode
 * off). Parties: one, two and three heroes with no henchmen (sword; sword and bow; sword, bow and
 * staff), then one sword hero with three henchmen (sword, bow, staff). Each over ten seeds of the
 * sim's rng (the floor is the story's own, fixed), reporting time to kill, damage taken, potions used
 * and downs, beside what 1.2's "today" predicts from the health scaling alone.
 *
 *   npm run bench:bosses                         (the Warden, Mossgate Barrow's last floor)
 *   npm run bench:bosses -- --story mossgate --seeds 10 --level 4
 *
 * Writes tests/tmp/bosses.json. A run that is neither a kill nor a wipe in `--minutes` (10) is a timeout.
 */
import fs from 'node:fs';
import { enemyStats, tuning, type Style } from '@hearthgate/shared/config/tuning';
import { HostSession } from '@hearthgate/shared/game/HostSession';
import { planChoice, floorSpecFor } from '@hearthgate/shared/game/runPlan';
import { STORY } from '@hearthgate/shared/game/portalChoice';
import { buildWorld } from '@hearthgate/shared/level/arena';
import { floorLevel, openMiddle } from '@hearthgate/shared/level/floor';
import { PROTOCOL_VERSION } from '@hearthgate/shared/net/protocol';
import { lookOf, wornMods, type Worn } from '@hearthgate/shared/sim/catalogue';
import type { Loadout } from '@hearthgate/shared/sim/coop';
import { isTargetable } from '@hearthgate/shared/sim/combat';
import { bossOf } from '@hearthgate/shared/sim/floorRun';
import { inTelegraph } from '@hearthgate/shared/sim/henchman';
import { levelFor } from '@hearthgate/shared/sim/gear';
import { emptyTalents } from '@hearthgate/shared/sim/talents';
import { idleCommand, type PlayerCommand, type PlayerState, type SimEvent } from '@hearthgate/shared/sim/types';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const STORY_ID = arg('story', 'mossgate');
const SEEDS = Math.max(1, Number(arg('seeds', '10')));
const story = STORY.find((s) => s.id === STORY_ID);
if (!story) throw new Error(`no story dungeon "${STORY_ID}" (${STORY.map((s) => s.id).join(', ')})`);
// "One hero at their style's level for that dungeon": the top of its guide by default.
const LEVEL = Number(arg('level', String(story.levels[1])));
const MAX_TICKS = Math.round(Number(arg('minutes', '10')) * 60 * tuning.sim.tickRate);

function xpFor(level: number): number {
  let xp = 0;
  while (levelFor(xp) < level) xp += 25;
  return xp;
}

const SLOT_OF: Record<string, keyof Worn> = {
  medHelm: 'head', chainbody: 'body', kiteshield: 'shield', coif: 'head', jerkin: 'body', chaps: 'legs', boots: 'feet',
  robeTop: 'body', robeSkirt: 'legs',
};
// A modest kit a style might wear at an early dungeon's level (gate-party's novices, a step up).
const GEAR: Record<Style, string[]> = {
  sword: ['bronze-medHelm', 'bronze-chainbody', 'bronze-kiteshield', 'bronze-sword'],
  bow: ['leather-coif', 'leather-jerkin', 'leather-chaps', 'leather-boots', 'oak-shortbow'],
  staff: ['linen-robeTop', 'linen-robeSkirt', 'ash-staff'],
};
/** A player's reaction to a telegraph, about 200 ms. */
const REACT_TICKS = 12;
/** About how far a roll carries a hero. */
const ROLL_M = 3.5;
/** Metres each style keeps from its target. */
const RANGE: Record<Style, number> = { sword: 1.6, bow: 8, staff: 6 };

function hero(name: string, style: Style): Loadout {
  const worn: Worn = {};
  GEAR[style].forEach((id, n) => {
    worn[SLOT_OF[id.slice(id.indexOf('-') + 1)] ?? 'weapon'] = { uid: `${name}-${n}`, id, rarity: 'common', perk: null, bonus: null };
  });
  const mods = wornMods(worn);
  const xp = { sword: 0, bow: 0, staff: 0, [style]: xpFor(LEVEL) };
  return { name, xp, talents: emptyTalents(), mods, maxHp: tuning.combat.heroMaxHp + mods.maxHp, look: lookOf(worn), potions: tuning.loop.potionMax };
}

interface Party {
  name: string;
  heroes: Style[];
  henchmen: Style[];
}
const PARTIES: Party[] = [
  { name: 'solo', heroes: ['sword'], henchmen: [] },
  { name: 'duo', heroes: ['sword', 'bow'], henchmen: [] },
  { name: 'trio', heroes: ['sword', 'bow', 'staff'], henchmen: [] },
  { name: 'solo+3 henchmen', heroes: ['sword'], henchmen: ['sword', 'bow', 'staff'] },
];

/** Per-hero memory between ticks. */
interface Mind {
  id: string;
  style: Style;
  seq: number;
  /** Ticks offset, so a party does not press its abilities in step. */
  phase: number;
  /** Enemy id -> tick it began winding up. */
  windups: Map<number, number>;
  lastX: number;
  lastZ: number;
  stuck: number;
  sidestep: number;
  side: number;
}

/**
 * A simple player, as gate-party's bots play: everyone on the boss (adds when one is closer), the
 * sword in reach and the bow and staff at range, Q and E now and then, a roll away from anything
 * winding up within reach, a potion under a third of health, and the nearest standing friend holds F
 * over a downed one.
 */
function brain(host: HostSession, m: Mind, tick: number): PlayerCommand {
  const st = host.sim;
  const me = st.players.find((p) => p.id === m.id);
  const cmd = idleCommand();
  if (!me) return cmd;
  const toward = (x: number, z: number) => {
    const dx = x - me.x;
    const dz = z - me.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d, d };
  };
  const moved = Math.hypot(me.x - m.lastX, me.z - m.lastZ);
  m.lastX = me.x;
  m.lastZ = me.z;
  const walk = (x: number, z: number) => {
    if (Math.hypot(x, z) > 0.3 && moved < 0.01) m.stuck++;
    else m.stuck = Math.max(0, m.stuck - 2);
    if (m.stuck > 45) {
      m.sidestep = 40;
      m.stuck = 0;
      m.side = -m.side;
    }
    if (m.sidestep > 0) {
      m.sidestep--;
      cmd.moveX = x * 0.3 - z * m.side;
      cmd.moveZ = z * 0.3 + x * m.side;
      return;
    }
    cmd.moveX = x;
    cmd.moveZ = z;
  };
  if (me.mode === 'down') return cmd;
  if (me.style !== m.style) cmd.swapTo = m.style;

  const downed = st.players.filter((p) => p.mode === 'down' && !p.henchman);
  for (const d of downed) {
    const helper = st.players
      .filter((p) => p.mode !== 'down' && !p.henchman)
      .sort((a, b) => Math.hypot(a.x - d.x, a.z - d.z) - Math.hypot(b.x - d.x, b.z - d.z))[0];
    if (helper?.id !== me.id) continue;
    const t = toward(d.x, d.z);
    cmd.aimX = t.x;
    cmd.aimZ = t.z;
    if (t.d < 1.1) cmd.interact = true;
    else walk(t.x, t.z);
    return cmd;
  }

  if (me.potions && me.potions > 0 && me.hp < me.maxHp * 0.33 && tick % 30 === 0) cmd.drink = true;

  const alive = st.enemies.filter(isTargetable);
  if (!alive.length) return cmd;
  const target = alive.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z) || a.id - b.id)[0];
  const t = toward(target.x, target.z);
  cmd.aimX = t.x;
  cmd.aimZ = t.z;
  cmd.lockTarget = target.id;
  // A telegraph it stands in, seen for a player's reaction time: roll out of it (out of a circle's
  // middle, across a line or cone), or walk out when no roll is left. Answered once a wind-up.
  // Every live telegraph a metre wider than drawn: a player keeps clear of its edge, not on it.
  const live = alive.filter((e) => e.tele.shape !== 'none').map((e) => ({ ...e, tele: { ...e.tele, radius: e.tele.radius + 1, arcDeg: Math.min(360, e.tele.arcDeg + 20) } }));
  const range = RANGE[m.style];
  const threat = live.find((e) => inTelegraph(e, me.x, me.z));
  if (threat) {
    // Out of it the way a player goes: of sixteen ways, the one whose landing a roll away is clear of
    // every telegraph and nearest where this hero wants to stand (round a sweep's edge, behind the boss).
    let best: { x: number; z: number } | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const ex = me.x + dx * ROLL_M;
      const ez = me.z + dz * ROLL_M;
      if (live.some((e) => inTelegraph(e, ex, ez))) continue;
      // Not through a body: a roll stops against an enemy as a walk does.
      if (alive.some((e) => {
        const along = Math.max(0, Math.min(ROLL_M, (e.x - me.x) * dx + (e.z - me.z) * dz));
        return Math.hypot(me.x + dx * along - e.x, me.z + dz * along - e.z) < enemyStats(e.kind).radius + 0.6;
      })) continue;
      const score = Math.abs(Math.hypot(target.x - ex, target.z - ez) - range);
      if (score < bestScore) {
        bestScore = score;
        best = { x: dx, z: dz };
      }
    }
    const away = toward(threat.tele.x, threat.tele.z);
    const out = best ?? { x: -away.x, z: -away.z };
    cmd.moveX = out.x;
    cmd.moveZ = out.z;
    const at = m.windups.get(threat.id);
    if (at !== undefined && tick - at >= REACT_TICKS && me.dodgeCharges > 0) {
      m.windups.delete(threat.id);
      cmd.dodge = true;
    }
    return cmd;
  }
  let go: { x: number; z: number } | null = null;
  if (t.d > range + 0.4) go = t;
  else if (range > 3 && t.d < range - 2.5) go = { x: -t.x, z: -t.z };
  // Out of a telegraph, it does not step back into one before it lands (a player waits, then closes).
  if (go && !live.some((e) => inTelegraph(e, me.x + go.x * 0.6, me.z + go.z * 0.6))) walk(go.x, go.z);
  const k = tick + m.phase;
  const inReach = t.d < range + 1.5;
  cmd.attack = inReach && k % 2 === 0;
  cmd.ability1 = inReach && k % 240 === 0;
  cmd.ability2 = inReach && k % 420 === 0 && m.style !== 'staff';
  return cmd;
}

interface Result {
  outcome: 'kill' | 'wipe' | 'timeout';
  seconds: number;
  bossHp: number;
  /** The boss's health left at the end, of its most (0 on a kill). */
  bossLeft: number;
  damageTaken: number;
  potionsUsed: number;
  downs: number;
}

function fight(party: Party, seed: number): Result {
  const plan = planChoice([], 1, { kind: 'story', id: story!.id });
  const spec = floorSpecFor(plan, plan.floors);
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const host = new HostSession(world, () => {}, false);
  const minds: Mind[] = party.heroes.map((style, i) => {
    const id = `p${i + 1}`;
    host.onMessage(id, { k: 'hello', version: PROTOCOL_VERSION, loadout: hero(`${style}${i}`, style) });
    return { id, style, seq: 0, phase: i * 37, windups: new Map(), lastX: 0, lastZ: 0, stuck: 0, sidestep: 0, side: 1 };
  });
  const lead = host.sim.players.find((p) => p.id === 'p1')!;
  for (const style of party.henchmen) host.addHenchman(lead, style);
  host.sim.rng = (seed * 2654435761) >>> 0 || 1;

  // Into the boss hall, everyone a step apart 5 m short of its middle, so the hall shuts and the boss
  // wakes. Not on the middle itself: the boss rises there, and a hero placed exactly on its spot turns
  // NaN on the first steps (some zero-length direction; walking in, no hero lands on it to the bit).
  const hall = level.dungeon!.pieces[level.dungeon!.def.exit];
  if (hall.kind !== 'boss') throw new Error('the last floor does not end in a boss hall');
  const mid = openMiddle(hall);
  host.sim.players.forEach((p, i) => {
    p.x = mid.x + (i % 2) * 1.2;
    p.z = mid.z + 5 + Math.floor(i / 2) * 1.2;
    p.y = hall.y;
  });

  const heroes = () => host.sim.players.filter((p) => !p.henchman);
  const hpWas = new Map(heroes().map((p) => [p.id, p.hp]));
  const potionsAtStart = heroes().reduce((a, p) => a + (p.potions ?? 0), 0);
  let damageTaken = 0;
  let downs = 0;
  let bossId = -1;
  let wokeAt = -1;
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    for (const m of minds) {
      m.seq++;
      const c = brain(host, m, tick);
      host.onMessage(m.id, { k: 'input', cmds: [{ seq: m.seq, cmd: c }] });
    }
    const events: SimEvent[] = host.tick();
    for (const ev of events) {
      if (ev.kind === 'enemyTelegraph') for (const m of minds) m.windups.set(ev.enemyId, tick);
      if (ev.kind === 'heroDown' && heroes().some((p) => p.id === ev.playerId)) downs++;
    }
    for (const p of heroes()) {
      const was = hpWas.get(p.id) ?? p.hp;
      if (p.hp < was) damageTaken += was - p.hp;
      hpWas.set(p.id, p.hp);
    }
    const r = host.sim.run;
    if (bossId < 0 && r.bossId >= 0 && host.sim.enemies.some((e) => e.id === r.bossId)) {
      bossId = r.bossId;
      wokeAt = host.sim.time;
    }
    const boss = host.sim.enemies.find((e) => e.id === bossId);
    const seconds = wokeAt >= 0 ? host.sim.time - wokeAt : 0;
    const potionsUsed = potionsAtStart - heroes().reduce((a, p) => a + (p.potions ?? 0), 0);
    const result = { seconds, bossHp: boss?.maxHp ?? 0, bossLeft: boss ? Math.max(0, boss.hp) / boss.maxHp : 1, damageTaken: Math.round(damageTaken), potionsUsed, downs };
    if (boss && boss.ai === 'dead') return { outcome: 'kill', ...result };
    if (heroes().every((p: PlayerState) => p.mode === 'down')) return { outcome: 'wipe', ...result };
  }
  const boss = host.sim.enemies.find((e) => e.id === bossId);
  return {
    outcome: 'timeout',
    seconds: wokeAt >= 0 ? host.sim.time - wokeAt : 0,
    bossHp: boss?.maxHp ?? 0,
    bossLeft: boss ? Math.max(0, boss.hp) / boss.maxHp : 1,
    damageTaken: Math.round(damageTaken),
    potionsUsed: potionsAtStart - heroes().reduce((a, p) => a + (p.potions ?? 0), 0),
    downs,
  };
}

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

tuning.debug.godMode = false;
const boss = bossOf(story.id);
console.log(`The boss bench: ${boss} in ${story.name}'s last floor (difficulty ${story.run.difficulty}), heroes at level ${LEVEL}, ${SEEDS} seeds`);
console.log(`health scaling today: 1 + (players - 1) x run.extraPlayerHealth (${tuning.run.extraPlayerHealth}), henchmen counted in full\n`);

const rows: { party: string; players: number; predictedHp: number; results: Result[] }[] = [];
for (const party of PARTIES) {
  const t0 = performance.now();
  const results: Result[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) results.push(fight(party, seed));
  const players = party.heroes.length + party.henchmen.length;
  rows.push({ party: party.name, players, predictedHp: 1 + (players - 1) * tuning.run.extraPlayerHealth, results });
  if (process.env.VERBOSE) console.log(`  ${party.name}: ${((performance.now() - t0) / 1000).toFixed(1)} s of wall time`);
}

const soloHp = median(rows[0].results.map((r) => r.bossHp));
const soloKill = median(rows[0].results.filter((r) => r.outcome === 'kill').map((r) => r.seconds));
const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`${'party'.padEnd(17)}${pad('boss hp', 8)}${pad('x solo', 7)}${pad('pred.', 7)}${pad('kills', 7)}${pad('ttk s', 8)}${pad('x solo', 8)}${pad('pred.', 7)}${pad('dmg', 7)}${pad('pots', 6)}${pad('downs', 7)}${pad('end s', 7)}${pad('left', 6)}`);
for (const row of rows) {
  const kills = row.results.filter((r) => r.outcome === 'kill');
  const hp = median(row.results.map((r) => r.bossHp));
  const ttk = median(kills.map((r) => r.seconds));
  // 1.2's "today": a party's damage grows about linearly with its heroes, so time to kill goes as health / players.
  const predTtk = row.predictedHp / row.players;
  console.log(
    `${row.party.padEnd(17)}${pad(Math.round(hp), 8)}${pad((hp / soloHp).toFixed(2), 7)}${pad(row.predictedHp.toFixed(2), 7)}` +
      `${pad(`${kills.length}/${row.results.length}`, 7)}${pad(Number.isFinite(ttk) ? ttk.toFixed(0) : '-', 8)}` +
      `${pad(Number.isFinite(ttk) && Number.isFinite(soloKill) ? (ttk / soloKill).toFixed(2) : '-', 8)}${pad(predTtk.toFixed(2), 7)}` +
      `${pad(Math.round(mean(row.results.map((r) => r.damageTaken))), 7)}${pad(mean(row.results.map((r) => r.potionsUsed)).toFixed(1), 6)}` +
      `${pad(mean(row.results.map((r) => r.downs)).toFixed(1), 7)}${pad(mean(row.results.map((r) => r.seconds)).toFixed(0), 7)}` +
      `${pad(`${Math.round(mean(row.results.map((r) => r.bossLeft)) * 100)}%`, 6)}`,
  );
}
const wipes = rows.map((r) => `${r.party} ${r.results.filter((x) => x.outcome === 'wipe').length}`).join(', ');
const timeouts = rows.map((r) => `${r.party} ${r.results.filter((x) => x.outcome === 'timeout').length}`).join(', ');
console.log(`\nwipes: ${wipes}\ntimeouts: ${timeouts}`);
console.log(`ttk is the median of kills only; dmg, pots and downs are means over every seed, heroes only (henchmen's not counted);\nend s is the mean fight length, kill, wipe or timeout; left is the boss's mean health at the end.`);
console.log(`1.2's bar: solo 180 to 300 s with a potion left; duo under half the solo time with nobody downed.`);

fs.mkdirSync('tests/tmp', { recursive: true });
fs.writeFileSync('tests/tmp/bosses.json', JSON.stringify({ story: story.id, boss, level: LEVEL, seeds: SEEDS, rows }, null, 2));

// The gate: the bench runs and its health scaling is the one 1.2 describes (it measures, it does not judge).
let ok = true;
for (const row of rows) {
  const hp = median(row.results.map((r) => r.bossHp));
  if (Math.abs(hp / soloHp - row.predictedHp) > 0.01) {
    console.error(`FAIL: ${row.party}'s boss has ${(hp / soloHp).toFixed(2)}x the solo health, 1.2 predicts ${row.predictedHp.toFixed(2)}`);
    ok = false;
  }
  if (row.results.some((r) => r.bossHp === 0)) {
    console.error(`FAIL: ${row.party}: the boss never woke in some runs`);
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
