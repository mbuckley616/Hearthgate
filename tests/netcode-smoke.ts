/**
 * Netcode smoke test that needs no browser.
 *
 * Boots the server on a spare port, joins two colyseus.js clients, drives one
 * of them with inputs for a second, and checks that:
 *   1. both clients see two players;
 *   2. the driven player moved on the server and the other client saw it;
 *   3. the goblin left idle and started chasing (this room runs the Phase 0 open field, one goblin, so
 *      the downs and Cleave steps below meet one enemy as they were written for);
 *   4. a third client flooding inputs at 80 a second is dropped, and the others stay;
 *   5. a downed player is picked up by a teammate standing next to them, and a Cleave
 *      lands and its cooldown reaches the other client;
 *   5b. inputs carrying the Revive Draught flag are accepted, and pressing it with no body
 *      in reach spends nothing; both clients see the count (the revive itself needs a
 *      30 s bleed-out, so it is proved in shared/src/draught.test.ts);
 *   5c. a held block raises the guard, a three-tick gap in the inputs does not lower it or
 *      re-open its parry window, the other client sees it, and letting go lowers it;
 *   6. the yard: a fresh room on the default level syncs four enemies and names its level, and a client
 *      walking into one of its walls is stopped by the server where the shared sim says;
 *   6b. the Warrens: a room made with level "warrens" syncs its enemies, all asleep while the party
 *      stands in the hall, the stairs shut and floor 1;
 *   7. stress: STRESS_BOTS bots (default 4) in a fresh yard room walk, swing and dodge at the
 *      client rate for STRESS_MS; every client sees every bot where the server has it,
 *      every input is applied, nobody is dropped, patches keep coming at the tick rate
 *      and the server tick keeps wall time.
 *
 * Run: npm run test:net
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "colyseus.js";
import { DOWNS, TICK_MS, WARRENS, YARD } from "@hearthgate/shared";

const PORT = 2599;
const STRESS_BOTS = Number(process.env.STRESS_BOTS ?? 4);
const STRESS_MS = Number(process.env.STRESS_MS ?? 5000);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url: string, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`server did not come up at ${url}`);
}

function fail(msg: string): never {
  throw new Error(msg);
}

/** The living enemy nearest (x, z) in a client's state, or null when the room is clear. */
function nearestEnemy(state: any, x: number, z: number): any {
  let best: any = null;
  let bestD = Infinity;
  state.enemies.forEach((e: any) => {
    if (e.phase === "dead") return;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  });
  return best;
}

async function main() {
  // Run from the server directory so tsx picks up server/tsconfig.json (experimentalDecorators).
  // Launch node directly with the tsx loader rather than "npx tsx": on Windows npx is a .cmd
  // shim that spawn() cannot exec without a shell, and a shell would orphan the server on kill.
  const server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: fileURLToPath(new URL("../server/", import.meta.url)),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

  try {
    await waitForHealth(`http://localhost:${PORT}/health`);

    const client = new Client(`ws://localhost:${PORT}`);
    const a = await client.create("dungeon", { name: "Alpha", level: "field" });
    const b = await client.joinById(a.roomId, { name: "Bravo" });

    let aState: any = null;
    let bState: any = null;
    a.onStateChange((s: any) => (aState = s));
    b.onStateChange((s: any) => (bState = s));

    await sleep(400);
    if (!aState || !bState) fail("no state received");
    if (aState.players.size !== 2 || bState.players.size !== 2) {
      fail(`expected 2 players on both clients, got ${aState.players.size} and ${bState.players.size}`);
    }
    if (aState.levelId !== "field" || bState.enemies.size !== 1) {
      fail(`expected the open field with 1 enemy, got level ${aState.levelId} with ${bState.enemies.size} enemies`);
    }

    const startX = aState.players.get(a.sessionId).x;
    // Drive Alpha to the right for one second at the client tick rate.
    let seq = 0;
    const driver = setInterval(() => {
      seq++;
      a.send("input", { seq, dx: 1, dy: 0, attack: seq % 10 === 0, dodge: false });
    }, TICK_MS);
    await sleep(1000);
    clearInterval(driver);
    await sleep(200);

    const aOnA = aState.players.get(a.sessionId);
    const aOnB = bState.players.get(a.sessionId);
    const moved = aOnA.x - startX;
    if (moved < 3) fail(`Alpha moved only ${moved.toFixed(2)} m on the server`);
    if (Math.abs(aOnB.x - aOnA.x) > 0.5) fail(`Bravo sees Alpha at x=${aOnB.x.toFixed(2)} but server says ${aOnA.x.toFixed(2)}`);
    if (aOnA.lastSeq < seq - 3) fail(`server applied seq ${aOnA.lastSeq} of ${seq}`);
    const nearGoblin = nearestEnemy(bState, aOnB.x, aOnB.z);
    if (!nearGoblin || nearGoblin.phase === "idle") fail("the nearest goblin never aggroed");

    console.log(
      `ok: 2 players synced in ${aState.levelId} with ${bState.enemies.size} enemies, Alpha moved ${moved.toFixed(2)} m, Bravo sees x=${aOnB.x.toFixed(2)}, nearest goblin is ${nearGoblin.phase}, server tick ${aState.tick}`
    );

    // Flood: 80 inputs a second sustained must get Charlie dropped with CLOSE_INPUT_FLOOD.
    const c = await client.joinById(a.roomId, { name: "Charlie" });
    let closeCode = 0;
    c.onLeave((code: number) => (closeCode = code));
    let cseq = 0;
    const flooder = setInterval(() => {
      for (let i = 0; i < 4; i++) c.send("input", { seq: ++cseq, dx: 0, dy: 1, attack: false, dodge: false });
    }, TICK_MS);
    const floodStart = Date.now();
    while (!closeCode && Date.now() - floodStart < 4000) await sleep(50);
    clearInterval(flooder);
    if (closeCode !== 4001) fail(`flooding client was not dropped (close code ${closeCode || "none"})`);
    await sleep(200);
    if (aState.players.size !== 2) fail(`expected 2 players after the drop, got ${aState.players.size}`);
    if (!a.connection.isOpen || !b.connection.isOpen) fail("an honest client was dropped with the flooder");
    console.log(`ok: flooder dropped after ${cseq} inputs in ${Date.now() - floodStart} ms, Alpha and Bravo still connected`);

    // Downs: Bravo stands in the goblin's reach until it downs them (seven swings, about
    // nine seconds), then Alpha walks over and stands still next to them for the pickup.
    let bseq = 0;
    const walkTo = (room: any, nextSeq: () => number, tx: number, tz: number, stopAt: number) => {
      const me = aState.players.get(room.sessionId);
      const vx = tx - me.x;
      const vz = tz - me.z;
      const d = Math.hypot(vx, vz);
      const k = d > stopAt ? 1 / d : 0;
      room.send("input", { seq: nextSeq(), dx: vx * k, dy: vz * k, attack: false, dodge: false });
    };
    const downStart = Date.now();
    const bravoWalker = setInterval(() => {
      const me = aState.players.get(b.sessionId);
      const e = nearestEnemy(aState, me.x, me.z);
      if (e) walkTo(b, () => ++bseq, e.x, e.z, 1.2);
    }, TICK_MS);
    while (!(aState.players.get(b.sessionId).downedUntil > 0) && Date.now() - downStart < 25000) await sleep(50);
    clearInterval(bravoWalker);
    const bDown = aState.players.get(b.sessionId);
    if (!(bDown.downedUntil > 0) || bDown.hp !== 0) fail(`Bravo was never downed (hp ${bDown.hp})`);
    const downedIn = Date.now() - downStart;

    const pickStart = Date.now();
    const alphaWalker = setInterval(() => {
      const bp = aState.players.get(b.sessionId);
      walkTo(a, () => ++seq, bp.x, bp.z, DOWNS.pickupRange * 0.6);
    }, TICK_MS);
    while (aState.players.get(b.sessionId).hp === 0 && Date.now() - pickStart < 8000) await sleep(50);
    clearInterval(alphaWalker);
    await sleep(200);
    const bUp = bState.players.get(b.sessionId);
    if (bUp.hp !== DOWNS.pickupHp || bUp.downedUntil !== 0) {
      fail(`Bravo was not picked up (hp ${bUp.hp}, downedUntil ${bUp.downedUntil})`);
    }
    console.log(`ok: Bravo downed after ${downedIn} ms, Alpha picked them up in ${Date.now() - pickStart} ms, Bravo at ${bUp.hp} hp`);

    // Cleave: Alpha walks up to the goblin and presses slot 1; the hit comes back as an event,
    // and Bravo sees Alpha's slot go on cooldown.
    const aEvents: any[] = [];
    a.onMessage("events", (evs: any[]) => aEvents.push(...evs));
    const cleaveStart = Date.now();
    let cleaved = false;
    const cleaver = setInterval(() => {
      const me = aState.players.get(a.sessionId);
      const e = nearestEnemy(aState, me.x, me.z);
      if (!e) return;
      const d = Math.hypot(e.x - me.x, e.z - me.z);
      if (d > 2) return walkTo(a, () => ++seq, e.x, e.z, 1.5);
      // Face the goblin with a tiny step, then press the slot.
      const k = 0.01 / d;
      a.send("input", { seq: ++seq, dx: (e.x - me.x) * k, dy: (e.z - me.z) * k, attack: false, dodge: false, ability: 1 });
    }, TICK_MS);
    while (!(cleaved = aEvents.some((x) => x.kind === "abilityHit" && x.attackerId === a.sessionId)) && Date.now() - cleaveStart < 8000) await sleep(50);
    clearInterval(cleaver);
    await sleep(200);
    if (!cleaved) fail("Alpha's Cleave never landed");
    const cd = bState.players.get(a.sessionId).readyAt[0];
    if (!(cd > bState.tick * TICK_MS)) fail(`Bravo does not see Alpha's Cleave cooling down (readyAt ${cd})`);
    console.log(`ok: Alpha's Cleave landed in ${Date.now() - cleaveStart} ms; Bravo sees it ready in ${((cd - bState.tick * TICK_MS) / 1000).toFixed(1)} s`);

    // Draught: five presses with nobody dead. The frames must be applied, not rejected as
    // invalid, and the count must stay at one on both clients.
    for (let i = 0; i < 5; i++) {
      a.send("input", { seq: ++seq, dx: 0, dy: 0, attack: false, dodge: false, use: true });
      await sleep(TICK_MS);
    }
    await sleep(300);
    const aDraught = aState.players.get(a.sessionId);
    if (aDraught.lastSeq !== seq) fail(`the server applied seq ${aDraught.lastSeq} of ${seq}: draught inputs rejected?`);
    const counts = [aDraught.draughts, bState.players.get(a.sessionId).draughts, bState.players.get(b.sessionId).draughts];
    if (counts.some((n) => n !== DOWNS.draughtsPerFloor)) fail(`draught counts ${counts.join(", ")}, expected ${DOWNS.draughtsPerFloor} each`);
    if (aEvents.some((x) => x.kind === "playerRevived")) fail("a draught revived someone with nobody dead");
    console.log(`ok: draught presses with no body in reach applied and spent nothing; both clients see ${DOWNS.draughtsPerFloor} each`);

    // Guard: Alpha holds block, goes quiet for three ticks (a late connection), holds again.
    // The server must keep the guard up through the gap with the window it opened first
    // (a re-raise would hand out a parry nobody timed), and Bravo must see it.
    const block = (on: boolean) => a.send("input", { seq: ++seq, dx: 0, dy: 0, attack: false, dodge: false, block: on });
    for (let i = 0; i < 6; i++) {
      block(true);
      await sleep(TICK_MS);
    }
    await sleep(150);
    const raised = aState.players.get(a.sessionId).blockSince;
    if (!aState.players.get(a.sessionId).guarding || !(raised > 0)) fail("the server did not raise Alpha's guard");
    await sleep(TICK_MS * 3);
    for (let i = 0; i < 6; i++) {
      block(true);
      await sleep(TICK_MS);
    }
    await sleep(150);
    const held = aState.players.get(a.sessionId);
    if (!held.guarding || held.blockSince !== raised) fail(`the guard dropped or re-opened across a quiet gap (blockSince ${raised} then ${held.blockSince}, guarding ${held.guarding})`);
    if (!bState.players.get(a.sessionId).guarding) fail("Bravo does not see Alpha's guard");
    block(false);
    await sleep(250);
    if (aState.players.get(a.sessionId).guarding) fail("Alpha's guard stayed up after letting go");
    console.log(`ok: Alpha's guard held through a 3-tick gap with its first window (raised at ${raised}); Bravo saw it; it drops on release`);

    await a.leave();
    await b.leave();
    await sleep(300);

    await yard(client);
    await warrens(client);
    await stress(client);
  } finally {
    server.kill("SIGTERM");
  }
}

/**
 * The default level: its enemies (four goblins and a Shieldbearer with its shield up) and walls reach the
 * client, and a wall stops a walker. Delta walks east
 * from the first spawn (-3, 3) along z = 3 into the wall at x = 5.6..6.4 (shared level.ts YARD): the server
 * must hold Delta at x = 5.1 (the wall's face less the player's radius) instead of letting them through.
 */
async function yard(client: Client) {
  const d = await client.create("dungeon", { name: "Delta", level: "yard" });
  let dState: any = null;
  d.onStateChange((s: any) => (dState = s));
  await sleep(400);
  if (!dState) fail("yard: no state received");
  const want = YARD.enemies.length;
  if (dState.levelId !== "yard" || dState.enemies.size !== want) fail(`yard: expected the yard with ${want} enemies, got ${dState.levelId} with ${dState.enemies.size}`);
  const kinds: string[] = [];
  let shieldsUp = 0;
  dState.enemies.forEach((e: any) => {
    kinds.push(e.kind);
    if (e.guardUp) shieldsUp++;
  });
  const expected = YARD.enemies.map((e) => e.kind);
  if (kinds.sort().join(",") !== [...expected].sort().join(",")) fail(`yard: expected ${expected.join(",")}, got ${kinds.join(",")}`);
  const shields = expected.filter((k) => k === "shieldbearer").length;
  if (shieldsUp !== shields) fail(`yard: ${shieldsUp} shields up, expected ${shields}`);
  const start = dState.players.get(d.sessionId);
  if (Math.abs(start.x + 3) > 0.01 || Math.abs(start.z - 3) > 0.01) fail(`yard: Delta spawned at ${start.x}, ${start.z}, not (-3, 3)`);
  let seq = 0;
  const walker = setInterval(() => d.send("input", { seq: ++seq, dx: 1, dy: 0, attack: false, dodge: false }), TICK_MS);
  await sleep(2500);
  clearInterval(walker);
  await sleep(200);
  const me = dState.players.get(d.sessionId);
  const face = 5.6 - 0.5;
  if (Math.abs(me.x - face) > 0.1 || Math.abs(me.z - 3) > 0.1) fail(`yard: after 2.5 s walking east Delta is at ${me.x.toFixed(2)}, ${me.z.toFixed(2)}; the wall should hold them at x = ${face}`);
  console.log(`ok: yard room has ${kinds.join(", ")} (${shieldsUp} shield up); the wall held Delta at x=${me.x.toFixed(2)} after ${seq} inputs east`);
  await d.leave();
  await sleep(300);
}

/** The Warrens floor (`?level=warrens`): its enemies arrive asleep, the stairs shut, floor 1. */
async function warrens(client: Client) {
  const w = await client.create("dungeon", { name: "Echo", level: "warrens" });
  let wState: any = null;
  w.onStateChange((s: any) => (wState = s));
  await sleep(600);
  if (!wState) fail("warrens: no state received");
  if (wState.levelId !== "warrens" || wState.enemies.size !== WARRENS.enemies.length) {
    fail(`warrens: expected ${WARRENS.enemies.length} enemies in the warrens, got ${wState.levelId} with ${wState.enemies.size}`);
  }
  let awake = 0;
  wState.enemies.forEach((e: any) => {
    if (e.phase !== "idle") awake++;
  });
  if (awake !== 0) fail(`warrens: ${awake} enemies woke with the party still in the hall`);
  if (wState.stairsOpen !== false || wState.floor !== 1) fail(`warrens: stairs ${wState.stairsOpen}, floor ${wState.floor}`);
  console.log(`ok: warrens room has ${wState.enemies.size} enemies asleep in their rooms, stairs shut, floor ${wState.floor}`);
  await w.leave();
  await sleep(300);
}

/** N scripted bots in one fresh yard room. Each walks a circle at its own phase, swings and dodges. */
async function stress(client: Client) {
  const first = await client.create("dungeon", { name: "Bot 1", level: "yard" });
  const bots = [first];
  for (let i = 1; i < STRESS_BOTS; i++) bots.push(await client.joinById(first.roomId, { name: `Bot ${i + 1}` }));

  const states: any[] = bots.map(() => null);
  const patchTimes: number[][] = bots.map(() => []);
  const closed: number[] = bots.map(() => 0);
  bots.forEach((r, i) => {
    r.onStateChange((s: any) => {
      states[i] = s;
      patchTimes[i].push(performance.now());
    });
    r.onLeave((code: number) => (closed[i] = code));
  });
  await sleep(400);
  for (let i = 0; i < bots.length; i++) {
    if (states[i]?.players.size !== STRESS_BOTS) fail(`stress: bot ${i + 1} sees ${states[i]?.players.size} players, expected ${STRESS_BOTS}`);
  }

  const seqs = bots.map(() => 0);
  const tickStart = states[0].tick;
  const wallStart = performance.now();
  for (const t of patchTimes) t.length = 0;
  const driver = setInterval(() => {
    bots.forEach((r, i) => {
      const k = ++seqs[i];
      const angle = (k / 20) * 1.5 + (i * 2 * Math.PI) / STRESS_BOTS;
      r.send("input", { seq: k, dx: Math.cos(angle), dy: Math.sin(angle), attack: k % 15 === i, dodge: k % 40 === i });
    });
  }, TICK_MS);
  await sleep(STRESS_MS);
  clearInterval(driver);
  const wallMs = performance.now() - wallStart;
  const ticks = states[0].tick - tickStart;
  const windowed = patchTimes.map((t) => t.slice());
  await sleep(300);

  closed.forEach((code, i) => code && fail(`stress: bot ${i + 1} was dropped (close code ${code})`));
  let worstSpread = 0;
  bots.forEach((r, i) => {
    const truth = states[i].players.get(r.sessionId);
    if (truth.lastSeq < seqs[i] - 3) fail(`stress: server applied seq ${truth.lastSeq} of ${seqs[i]} for bot ${i + 1}`);
    for (let j = 0; j < bots.length; j++) {
      const seen = states[j].players.get(r.sessionId);
      worstSpread = Math.max(worstSpread, Math.hypot(seen.x - truth.x, seen.z - truth.z));
    }
  });
  if (worstSpread > 0.5) fail(`stress: clients disagree on a bot's position by ${worstSpread.toFixed(2)} m`);

  // Patches: one per tick to every client, with no long gaps.
  const rates = windowed.map((t) => (t.length * 1000) / wallMs);
  const gaps = windowed.map((t) => t.slice(1).reduce((m, x, k) => Math.max(m, x - t[k]), 0));
  const minRate = Math.min(...rates);
  const maxGap = Math.max(...gaps);
  if (minRate < 0.9 * (1000 / TICK_MS)) fail(`stress: a client got only ${minRate.toFixed(1)} patches a second`);
  if (maxGap > 4 * TICK_MS) fail(`stress: a client waited ${maxGap.toFixed(0)} ms between patches`);
  const tickRate = (ticks * TICK_MS) / wallMs;
  if (Math.abs(tickRate - 1) > 0.05) fail(`stress: the server tick ran at ${tickRate.toFixed(3)} of wall time`);

  console.log(
    `ok: stress ${STRESS_BOTS} bots for ${(wallMs / 1000).toFixed(1)} s: ${Math.min(...seqs)} inputs each, all applied, ` +
      `clients agree within ${worstSpread.toFixed(3)} m, patches ${minRate.toFixed(1)}/s min, worst gap ${maxGap.toFixed(0)} ms, ` +
      `server tick ${tickRate.toFixed(3)} of wall time`
  );
  for (const r of bots) await r.leave();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAIL:", err.message ?? err);
    process.exit(1);
  });
