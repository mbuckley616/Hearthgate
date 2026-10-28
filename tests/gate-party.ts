/**
 * The Phase 1 gate's machine stand-in (Michael, 27 Oct: no second player to hand, "play it with bots
 * for me"): a mixed-level party of four bots takes the village's ring into a generated run and
 * clears floor 1 to its rest room, fighting every room that shuts on the way with no cheats, and
 * the run's combos, downs and revives are counted from what the server sends.
 *
 * The party, as four friends of different standing might come:
 *   Veteran  sword, level 10, steel plate               (the one who has played most)
 *   Hunter   bow, level 4, leather
 *   Novice   staff, level 1, linen                      (their first run)
 *   Squire   sword, level 1, bronze
 * Each bot plays as a simple player would: the party follows the floor's route between doorways;
 * in a fight everyone takes the same target (the enemy nearest the veteran), the sword fighters close
 * in and the bow and staff keep their range; they press their abilities now and then, roll away from
 * an enemy winding up beside them, and the nearest standing friend goes to a downed one and holds F.
 * Nothing they do is a cheat: every command is one a keyboard could send.
 *
 *   npm run gate:party                                         (boots a local server)
 *   npm run gate:party -- --server wss://hearthgate-8lrq.onrender.com
 *
 * With `--client <url>` the squire is a real browser (marked * in the numbers) and its screen is
 * saved to tests/tmp/gate-shots/ at every combo and every few seconds of a fight.
 *
 * Writes tests/tmp/gate-party.json and prints the numbers the playtest note files.
 */
import fs from "node:fs";
import { tuning, type Style } from "@hearthgate/shared/config/tuning";
import { floorLevel, walkRoute, type FloorLayout } from "@hearthgate/shared/level/floor";
import { village } from "@hearthgate/shared/level/village";
import { lookOf, wornMods, type Worn } from "@hearthgate/shared/sim/catalogue";
import type { Loadout } from "@hearthgate/shared/sim/coop";
import { isTargetable } from "@hearthgate/shared/sim/combat";
import { levelFor } from "@hearthgate/shared/sim/gear";
import { emptyTalents } from "@hearthgate/shared/sim/talents";
import type { EnemyState, PlayerCommand, SimEvent } from "@hearthgate/shared/sim/types";
import { chromium, type Page } from "@playwright/test";
import { Bot, bootServer, command, sleep, waitForHealth } from "./bots";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const REMOTE = arg("server");
const PORT = 2601;
const ENDPOINT = REMOTE ?? `ws://127.0.0.1:${PORT}`;
const HEALTH = REMOTE ? `${REMOTE.replace(/^ws/, "http")}/health` : `http://127.0.0.1:${PORT}/health`;
const TIMEOUT_MS = Number(arg("minutes") ?? 15) * 60_000;
/** With a client to load (`--client http://localhost:5173`), the squire is a real browser instead of a bot, and its screen is captured. */
const CLIENT = arg("client");
const SHOTS = "tests/tmp/gate-shots";

/**
 * The squire in a real browser: the game as a player sees it, joined to the party's village by
 * code, with an autopilot in the page that feeds the game's own commands (as the browser tests
 * steer). It walks to a goal when given one, otherwise follows the veteran, fights the party's
 * target and picks up a friend who is down beside it; the camera turns toward whatever it faces.
 */
async function browserSquire(code: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log(`[browser] ${e.message}`));
  // tsx names the functions it compiles with a helper the page lacks; give the page one.
  await page.addInitScript("window.__name = (f) => f");
  const squire = PARTY[3];
  await page.goto(`${CLIENT}/?server=${ENDPOINT}`);
  await page.evaluate((gear) => {
    const worn: Record<string, unknown> = {};
    const slots: Record<string, string> = { medHelm: "head", chainbody: "body" };
    gear.forEach((id, n) => (worn[slots[id.slice(id.indexOf("-") + 1)] ?? "weapon"] = { uid: `squire-${n}`, id, rarity: "common", perk: null, bonus: null }));
    const prof = { version: 2, xp: { sword: 0, bow: 0, staff: 0 }, bag: Array(28).fill(null), worn, talents: { sword: {}, bow: {}, staff: {} }, runs: 0, wins: 0, name: "Squire" };
    localStorage.setItem("hearthgate.profile.v2", JSON.stringify(prof));
  }, squire.gear);
  await page.goto(`${CLIENT}/?join=${code}&server=${ENDPOINT}`);
  await page.waitForFunction(() => (window as any).game?.session?.playing, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const g = (window as any).game;
    const A = ((window as any).__auto = { goal: null as null | { x: number; z: number }, follow: false });
    const orig = g.buildCommand.bind(g);
    let k = 0;
    g.buildCommand = (a: unknown) => {
      const c = orig(a);
      g.overlay.style.display = "none";
      const h = g.session.hero();
      if (!h) return c;
      const me = h.curr;
      const st = g.session.view().curr;
      k++;
      const go = (x: number, z: number, stop: number) => {
        const dx = x - me.x;
        const dz = z - me.z;
        const d = Math.hypot(dx, dz) || 1;
        return d > stop ? { moveX: dx / d, moveZ: dz / d } : { moveX: 0, moveZ: 0 };
      };
      const face = (x: number, z: number) => {
        const dx = x - me.x;
        const dz = z - me.z;
        const d = Math.hypot(dx, dz) || 1;
        // The camera swings round behind the squire, toward what it faces.
        const want = Math.atan2(-dx, -dz);
        g.cam.yaw += Math.atan2(Math.sin(want - g.cam.yaw), Math.cos(want - g.cam.yaw)) * 0.05;
        return { aimX: dx / d, aimZ: dz / d };
      };
      if (A.goal) return { ...c, ...go(A.goal.x, A.goal.z, 0.4) };
      if (!A.follow || me.mode === "down") return c;
      const vet = st.players.find((p: any) => p.name === "Veteran") ?? me;
      const downed = st.players.find((p: any) => p.mode === "down" && p.id !== me.id && Math.hypot(p.x - me.x, p.z - me.z) < 5);
      if (downed) {
        const d = Math.hypot(downed.x - me.x, downed.z - me.z);
        return { ...c, ...go(downed.x, downed.z, 0.9), ...face(downed.x, downed.z), interact: d < 1.1 };
      }
      const foes = st.enemies.filter((e: any) => e.ai !== "dead" && e.ai !== "spawn" && Math.abs(e.y - me.y) < 2.5);
      if (foes.length) {
        const t = foes.sort((a: any, b: any) => Math.hypot(a.x - vet.x, a.z - vet.z) - Math.hypot(b.x - vet.x, b.z - vet.z))[0];
        const d = Math.hypot(t.x - me.x, t.z - me.z);
        // Presses go where the keyboard's do: the game lays its pending presses over the built command.
        if (d < 2.6 && k % 2 === 0) g.pending.attack = true;
        if (d < 2.6 && k % 250 === 0) g.pending.ability1 = true;
        return { ...c, ...go(t.x, t.z, 1.4), ...face(t.x, t.z), lockTarget: t.id };
      }
      return { ...c, ...go(vet.x, vet.z, 2.5), ...face(vet.x, vet.z) };
    };
  });
  return { page, close: () => browser.close() };
}

/** The xp that reaches a level (the slice's thresholds, as tuning has them). */
function xpFor(level: number): number {
  let xp = 0;
  while (levelFor(xp) < level) xp += 50;
  return xp;
}

// The slot of each catalogue shape the party wears (the shape follows the material in an id).
const SLOT_OF: Record<string, keyof Worn> = {
  fullHelm: "head", medHelm: "head", coif: "head", hat: "head",
  platebody: "body", chainbody: "body", jerkin: "body", robeTop: "body",
  platelegs: "legs", chaps: "legs", robeSkirt: "legs",
  boots: "feet", gauntlets: "hands", vambraces: "hands", gloves: "hands", kiteshield: "shield",
};
function withSlots(name: string, style: Style, level: number, ids: string[]): Loadout {
  const worn: Worn = {};
  ids.forEach((id, n) => {
    const shape = id.slice(id.indexOf("-") + 1);
    worn[SLOT_OF[shape] ?? "weapon"] = { uid: `${name}-${n}`, id, rarity: "common", perk: null, bonus: null };
  });
  const mods = wornMods(worn);
  const xp = { sword: 0, bow: 0, staff: 0 };
  xp[style] = xpFor(level);
  return { name, xp, talents: emptyTalents(), mods, maxHp: tuning.combat.heroMaxHp + mods.maxHp, look: lookOf(worn) };
}

interface Member {
  bot: Bot;
  style: Style;
  level: number;
  /** Metres to keep from the target. */
  range: number;
  /** Ticks offset, so the party does not press its abilities in step. */
  phase: number;
}

const PARTY: { name: string; style: Style; level: number; gear: string[]; range: number }[] = [
  { name: "Veteran", style: "sword", level: 10, gear: ["steel-fullHelm", "steel-platebody", "steel-platelegs", "steel-gauntlets", "steel-boots", "steel-kiteshield", "steel-sword"], range: 1.4 },
  { name: "Hunter", style: "bow", level: 4, gear: ["leather-coif", "leather-jerkin", "leather-chaps", "leather-boots", "oak-shortbow"], range: 7 },
  { name: "Novice", style: "staff", level: 1, gear: ["linen-robeTop", "linen-robeSkirt", "ash-staff"], range: 5.5 },
  { name: "Squire", style: "sword", level: 1, gear: ["bronze-medHelm", "bronze-chainbody", "bronze-sword"], range: 1.4 },
];

/** Per-bot memory between ticks. */
interface Mind {
  wp: number;
  lastX: number;
  lastZ: number;
  stuckTicks: number;
  sidestep: number;
  seenEvents: number;
  /** Enemy id -> tick it began winding up. */
  windups: Map<number, number>;
  tick: number;
  /** A fight was on last tick (when it ends, the bot rejoins the route where it stands). */
  fighting: boolean;
  /** Which way the next sidestep goes. */
  side: number;
}

function brain(m: Member, party: Member[], route: { x: number; z: number }[], mind: Mind, minds: Mind[]): PlayerCommand {
  const b = m.bot;
  mind.tick++;
  const st = b.state;
  const me = b.me();
  if (!me) return command();
  for (; mind.seenEvents < b.events.length; mind.seenEvents++) {
    const ev = b.events[mind.seenEvents];
    if (ev.kind === "enemyTelegraph") mind.windups.set(ev.enemyId, mind.tick);
  }
  const swapTo = me.style !== m.style ? m.style : null;
  const toward = (x: number, z: number, speed = 1) => {
    const dx = x - me.x;
    const dz = z - me.z;
    const d = Math.hypot(dx, dz) || 1;
    return { moveX: (dx / d) * speed, moveZ: (dz / d) * speed, aimX: dx / d, aimZ: dz / d, d };
  };
  // Unstick: if we meant to move and have not, step sideways for a moment.
  const moved = Math.hypot(me.x - mind.lastX, me.z - mind.lastZ);
  mind.lastX = me.x;
  mind.lastZ = me.z;
  const steer = (c: { moveX: number; moveZ: number }) => {
    if (Math.hypot(c.moveX, c.moveZ) > 0.3 && moved < 0.01) mind.stuckTicks++;
    else mind.stuckTicks = Math.max(0, mind.stuckTicks - 2);
    if (mind.stuckTicks > 45) {
      mind.sidestep = 40;
      mind.stuckTicks = 0;
      mind.side = -mind.side;
    }
    if (mind.sidestep > 0) {
      mind.sidestep--;
      return { moveX: c.moveX * 0.3 - c.moveZ * mind.side, moveZ: c.moveZ * 0.3 + c.moveX * mind.side, jump: mind.sidestep === 39 };
    }
    return c;
  };

  if (me.mode === "down") {
    // Crawl to the nearest standing friend, so they reach us sooner.
    const friend = st.players.filter((p) => p.id !== me.id && p.mode !== "down").sort((a, c) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(c.x - me.x, c.z - me.z))[0];
    if (!friend) return command({ swapTo });
    const t = toward(friend.x, friend.z);
    return command({ moveX: t.moveX, moveZ: t.moveZ, aimX: t.aimX, aimZ: t.aimZ });
  }

  const alive = st.enemies.filter(isTargetable);
  const near = (e: EnemyState) => Math.abs(e.y - me.y) < 2.5;

  // A friend is down: the nearest of us who stands goes and holds F.
  const downed = st.players.filter((p) => p.mode === "down");
  for (const d of downed) {
    const helpers = st.players.filter((p) => p.mode !== "down").sort((a, c) => Math.hypot(a.x - d.x, a.z - d.z) - Math.hypot(c.x - d.x, c.z - d.z));
    if (helpers[0]?.id !== me.id) continue;
    const t = toward(d.x, d.z);
    if (t.d < 1.1) return command({ interact: true, aimX: t.aimX, aimZ: t.aimZ, swapTo });
    const s = steer({ moveX: t.moveX, moveZ: t.moveZ });
    return command({ ...s, aimX: t.aimX, aimZ: t.aimZ, sprint: alive.length === 0, swapTo });
  }

  if (alive.length) {
    mind.fighting = true;
    // Everyone takes the same target, the enemy nearest the veteran, so states one sets another pays off.
    const lead = party[0].bot.me() ?? me;
    const pool = alive.filter(near).length ? alive.filter(near) : alive;
    const target = pool.sort((a, c) => Math.hypot(a.x - lead.x, a.z - lead.z) - Math.hypot(c.x - lead.x, c.z - lead.z) || a.id - c.id)[0];
    const t = toward(target.x, target.z);
    // An enemy winding up within reach of us: roll away from it.
    for (const e of alive) {
      const at = mind.windups.get(e.id);
      if (at === undefined || mind.tick - at > 15) continue;
      const d = Math.hypot(e.x - me.x, e.z - me.z);
      if (d < 3.2 && me.dodgeCharges > 0) {
        mind.windups.delete(e.id);
        return command({ dodge: true, moveX: (me.x - e.x) / d, moveZ: (me.z - e.z) / d, aimX: t.aimX, aimZ: t.aimZ, swapTo });
      }
    }
    let move = { moveX: 0, moveZ: 0 };
    if (t.d > m.range + 0.4) move = steer({ moveX: t.moveX, moveZ: t.moveZ });
    else if (m.range > 3 && t.d < m.range - 2.5) move = steer({ moveX: -t.moveX, moveZ: -t.moveZ });
    const k = mind.tick + m.phase;
    const inReach = t.d < m.range + 1.5;
    return command({
      ...move,
      aimX: t.aimX,
      aimZ: t.aimZ,
      lockTarget: target.id,
      attack: inReach && k % 2 === 0,
      // Q every four seconds or so; E every seven (the staff's E is Blink, which a novice saves for trouble).
      ability1: inReach && k % 240 === 0 && (m.style !== "staff" || t.d < 4),
      ability2: inReach && k % 420 === 0 && m.style !== "staff",
      swapTo,
    });
  }

  // No fight: follow the route, waiting for whoever is furthest behind. Fresh from a fight, rejoin it at
  // the nearest point (the way back to the old one can lie through a wall).
  if (mind.fighting) {
    mind.fighting = false;
    let best = Math.min(mind.wp, route.length - 1);
    route.forEach((pt, i) => {
      if (Math.hypot(pt.x - me.x, pt.z - me.z) < Math.hypot(route[best].x - me.x, route[best].z - me.z)) best = i;
    });
    mind.wp = best;
  }
  if (mind.wp >= route.length) return command({ swapTo });
  const wp = route[mind.wp];
  const t = toward(wp.x, wp.z);
  if (t.d < 1.5) mind.wp++;
  // Only those ahead on the route wait (were everyone to wait for the furthest, nobody would move).
  const behind = party.filter((o, i) => {
    const p = o.bot.me();
    return p && p.mode !== "down" && p.id !== me.id && minds[i].wp < mind.wp;
  });
  const lag = Math.max(0, ...behind.map((o) => Math.hypot(o.bot.me()!.x - me.x, o.bot.me()!.z - me.z)));
  if (lag > 7) return command({ aimX: t.aimX, aimZ: t.aimZ, swapTo });
  return command({ ...steer({ moveX: t.moveX, moveZ: t.moveZ }), aimX: t.aimX, aimZ: t.aimZ, swapTo });
}

async function main() {
  const server = REMOTE ? null : bootServer(PORT);
  const started = new Date().toISOString();
  const members: Member[] = [];
  let eye: { page: Page; close: () => Promise<void> } | null = null;
  try {
    await waitForHealth(HEALTH, 120_000);
    // The village: the veteran makes it, the others join by its code.
    for (const [i, p] of (CLIENT ? PARTY.slice(0, 3) : PARTY).entries()) {
      const bot = new Bot(p.name, ENDPOINT, withSlots(p.name, p.style, p.level, p.gear));
      await bot.join(i === 0 ? null : members[0].bot.code, "village");
      members.push({ bot, style: p.style, level: p.level, range: p.range, phase: i * 61 });
    }
    const lead = members[0].bot;
    eye = CLIENT ? await browserSquire(lead.code) : null;
    const goal = (to: { x: number; z: number } | null) => eye?.page.evaluate((g) => ((window as any).__auto.goal = g), to);
    const edits = lead.messages.filter((m) => m.k === "tuning").map((m) => (m as { edits: Record<string, unknown> }).edits).pop() ?? {};
    console.log(`village ${lead.code} on ${ENDPOINT}; server tuning edits in force: ${JSON.stringify(edits)}`);
    const home = lead.code;

    // Round the well and into the ring together.
    const ring = village.village!.portal;
    const round: [number, number][] = [[-3.2, 2], [3.2, 2], [-3.2, 3], [3.2, 3]];
    await goal({ x: round[3][0], z: round[3][1] });
    await Promise.all(members.map((m, i) => m.bot.walkTo(round[i][0], round[i][1], 1, 60_000)));
    const spot: [number, number][] = [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]];
    await goal({ x: ring.x + spot[3][0], z: ring.z + spot[3][1] });
    await Promise.all(members.map((m, i) => m.bot.walkTo(ring.x + spot[i][0], ring.z + spot[i][1], 1.5, 60_000)));
    await Promise.all(members.map((m) => m.bot.until(() => m.bot.handoff !== null, 30_000, `${m.bot.name}'s hand-off`)));
    await Promise.all(members.map((m) => m.bot.takeHandoff()));
    if (eye) {
      await eye.page.waitForFunction((code) => (window as any).game.session.code === code && (window as any).game.session.playing, lead.code, { timeout: 30_000 });
      await goal(null);
      await eye.page.evaluate(() => ((window as any).__auto.follow = true));
      fs.rmSync(SHOTS, { recursive: true, force: true });
      fs.mkdirSync(SHOTS, { recursive: true });
    }
    const spec = lead.floor!;
    if (!members.every((m) => m.bot.code === lead.code)) throw new Error("the party did not land in one room");
    const layout: FloorLayout = floorLevel(spec).dungeon!;
    const route = walkRoute(layout, layout.def.entrance, layout.def.exit);
    const fightRooms = layout.pieces.filter((p) => p.fight).length;
    console.log(`floor ${spec.floor} of ${spec.floors}: ${spec.pieces} pieces (seed ${spec.seed}), room ${lead.code}, ${route.length} waypoints, from village ${home}`);

    const from = members.map((m) => m.bot.events.length);
    const xp0 = members.map((m) => ({ ...m.bot.me()!.xp }));
    const squireXp0 = lead.state.players.find((p) => p.name === "Squire")?.xp.sword ?? 0;
    const minds: Mind[] = members.map(() => ({ wp: 0, lastX: 0, lastZ: 0, stuckTicks: 0, sidestep: 0, seenEvents: 0, windups: new Map(), tick: 0, fighting: false, side: 1 }));
    members.forEach((m, i) => (minds[i].seenEvents = m.bot.events.length));
    const downs = new Map<string, number>(members.map((m) => [m.bot.id, 0]));
    const wasDown = new Map<string, boolean>();
    const t0 = performance.now();
    let outcome = "timeout";
    let beat = 0;
    let shots = 0;
    let lastShot = 0;
    let restShot = false;
    let seenCombo = lead.events.length;
    while (performance.now() - t0 < TIMEOUT_MS) {
      await Promise.all(members.map((m, i) => m.bot.drive(30, () => brain(m, members, route, minds[i], minds))));
      const st = lead.state;
      if (++beat % 40 === 0) {
        const who = members.map((m, i) => {
          const p = m.bot.me();
          return p ? `${m.bot.name} ${p.mode} ${Math.round(p.hp)}hp (${p.x.toFixed(0)},${p.z.toFixed(0)}) wp${minds[i].wp}` : `${m.bot.name} gone`;
        });
        console.log(`${Math.round((performance.now() - t0) / 1000)}s ${st.run.phase} fights ${st.floor?.fights ?? 0} cleared ${st.floor?.cleared.length ?? 0} enemies ${st.enemies.filter(isTargetable).length} | ${who.join(" | ")}`);
      }
      // The squire's screen: at every combo, and every few seconds while there is a fight on.
      if (eye && shots < 60) {
        const fresh = lead.events.slice(seenCombo);
        seenCombo = lead.events.length;
        const combo = fresh.find((e) => e.kind === "combo");
        const fighting = st.enemies.some(isTargetable);
        const now = performance.now();
        if (combo || (fighting && now - lastShot > 3000) || (st.floor?.rested && !restShot)) {
          if (st.floor?.rested) restShot = true;
          lastShot = now;
          const label = combo?.kind === "combo" ? `combo-${combo.combo}` : st.floor?.rested ? "rest" : "fight";
          await eye.page.screenshot({ path: `${SHOTS}/${String(++shots).padStart(2, "0")}-${label}.png` });
        }
      }
      for (const p of st.players) {
        const down = p.mode === "down";
        if (down && !wasDown.get(p.id)) downs.set(p.id, (downs.get(p.id) ?? 0) + 1);
        wasDown.set(p.id, down);
      }
      // Keep a little history only: a long run's snapshots would fill the memory.
      for (const m of members) {
        if (m.bot.snaps.length > 120) m.bot.snaps.splice(0, m.bot.snaps.length - 60);
        m.bot.messages.length = 0;
      }
      if (st.floor?.rested) {
        outcome = "cleared";
        break;
      }
      if (st.run.phase === "lost") {
        outcome = "wiped";
        break;
      }
      if (members.some((m) => m.bot.closedWith !== null)) {
        console.log(`closed: ${members.map((m) => `${m.bot.name} ${m.bot.closedWith}`).join(", ")}`);
        outcome = "disconnected";
        break;
      }
    }
    const seconds = (performance.now() - t0) / 1000;
    const st = lead.state;
    const evs: SimEvent[] = lead.events.slice(from[0]);
    const combos = evs.filter((e): e is Extract<SimEvent, { kind: "combo" }> => e.kind === "combo");
    const hits = evs.filter((e): e is Extract<SimEvent, { kind: "hit" }> => e.kind === "hit");
    const name = (id: string) => st.players.find((p) => p.id === id)?.name ?? id;
    // The bots, and the squire in the browser when there is one.
    const roster = members.map((m, i) => ({ id: m.bot.id, name: m.bot.name, style: m.style, level: m.level, armour: m.bot.kit.mods.armour ?? 0, xpFrom: xp0[i][m.style] }));
    const squire = eye ? st.players.find((p) => p.name === "Squire") : undefined;
    if (squire) roster.push({ id: squire.id, name: "Squire*", style: "sword", level: 1, armour: squire.mods.armour ?? 0, xpFrom: squireXp0 });
    const people = roster.map((r) => {
      const p = st.players.find((q) => q.id === r.id)!;
      const mine = hits.filter((h) => h.attackerId === r.id);
      return {
        name: r.name,
        style: r.style,
        level: r.level,
        levelNow: levelFor(p.xp[r.style]),
        armour: r.armour,
        damage: Math.round(mine.reduce((s, h) => s + h.damage, 0)),
        kills: mine.filter((h) => h.killed).length,
        xpGained: Math.round(p.xp[r.style] - r.xpFrom),
        downs: downs.get(r.id) ?? 0,
        bledOut: evs.filter((e) => e.kind === "bledOut" && e.playerId === r.id).length,
        revivedOthers: evs.filter((e) => e.kind === "revived" && e.by === r.id).length,
        combosFinished: combos.filter((c) => c.playerId === r.id).length,
      };
    });
    const total = people.reduce((s, p) => s + p.damage, 0) || 1;
    const result = {
      started,
      server: ENDPOINT,
      outcome,
      seconds: Math.round(seconds),
      floor: { ...spec, hand: undefined, fightRoomsOnFloor: fightRooms, fightsStarted: st.floor?.fights ?? 0, roomsCleared: st.floor?.cleared.length ?? 0 },
      combos: { total: combos.length, byKind: Object.fromEntries(["shatter", "skewer", "detonate"].map((k) => [k, combos.filter((c) => c.combo === k).length])), byWho: combos.map((c) => `${c.combo} by ${name(c.playerId)}`) },
      revives: evs.filter((e) => e.kind === "revived").map((e) => (e.kind === "revived" ? `${name(e.by)} picked up ${name(e.playerId)}${e.draught ? " with a draught" : ""}` : "")),
      people: people.map((p) => ({ ...p, damageShare: Math.round((p.damage / total) * 100) })),
    };
    fs.mkdirSync("tests/tmp", { recursive: true });
    fs.writeFileSync("tests/tmp/gate-party.json", JSON.stringify(result, null, 2));
    console.log(`\n${outcome.toUpperCase()} in ${result.seconds} s: ${result.floor.roomsCleared} rooms cleared of ${result.floor.fightsStarted} fought (${fightRooms} fight rooms on the floor)`);
    console.log(`combos: ${combos.length} (${JSON.stringify(result.combos.byKind)})`);
    for (const p of result.people)
      console.log(`  ${p.name.padEnd(8)} ${p.style.padEnd(5)} lv ${p.level}->${p.levelNow}  armour ${p.armour.toFixed(2)}  damage ${p.damage} (${p.damageShare}%)  kills ${p.kills}  downs ${p.downs}  bled out ${p.bledOut}  revived others ${p.revivedOthers}  combos ${p.combosFinished}`);
    for (const r of result.revives) console.log(`  revive: ${r}`);
    process.exitCode = outcome === "cleared" && combos.length > 0 ? 0 : 1;
  } finally {
    await eye?.close();
    for (const m of members) await m.bot.leave();
    server?.kill();
    await sleep(200);
  }
}

void main();
