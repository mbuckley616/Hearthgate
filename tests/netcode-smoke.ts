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
 *   5d. sprint and jump: a bot sprinting east for a second covers sprint distance on the server,
 *      and a jump taken from the sprint reaches the other client as a landing time and the
 *      carried takeoff speed, and lands where the shared sim says;
 *   6. the yard: a fresh room on the default level syncs four enemies and names its level, and a client
 *      walking into one of its walls is stopped by the server where the shared sim says;
 *   6b. the Warrens: a room made with level "warrens" syncs its enemies, all asleep while the party
 *      stands in the hall, the stairs shut;
 *   6c. the village and the hand-off: two bots join a village room (no enemies, four villagers); one
 *      talks to the keeper with the use key; both hold the portal and are handed seats in one fresh
 *      Warrens room, with their names and weapons; then, in a cellar floor, they kill its goblin,
 *      hold the open stairs and are handed back to a village together;
 *   6e. the hand-off in the real client (`Net`): one player walks through the portal and can move
 *      in the Warrens straight after; then a seat that cannot be taken lands it in the village,
 *      still able to move, never stranded with no room (Michael's "stuck after the portal");
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
import { Net } from "../client/src/net.ts";
import { CELLAR, DOWNS, NPC, PLAYER, PORTAL, STAIRS, TICK_MS, VILLAGE, WARRENS, WEAPON_CLASSES, YARD } from "@hearthgate/shared";

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

    await weaponPick(client);
    await lockOn(client);
    await jumpSprint(client);
    await yard(client);
    await warrens(client);
    await village(client);
    await stairsBack(client);
    await handoffClient();
    await combo(client);
    await stress(client);
  } finally {
    server.kill("SIGTERM");
  }
}

/**
 * 6e. The hand-off as the browser does it, through the real `Net`: frames predicted and sent at
 * the client rate, the seat taken from the "handoff" message, the clock and the pending inputs
 * started over. Then the failure Michael's report points at: a seat the server will not honour.
 * Before Session 47 a refused seat left `Net` with no room at all, so the player stood in the new
 * level, drawn and with the HUD up, and every input went nowhere.
 */
async function handoffClient() {
  const net = new Net();
  let seq = 0;
  /** Send frames at the client rate for `ms`, steering with `steer` (null stops early). */
  const drive = async (ms: number, steer: () => { dx: number; dy: number } | null) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const s = steer();
      if (!s) return;
      net.tick({ seq: ++seq, dx: s.dx, dy: s.dy, attack: false, dodge: false });
      await sleep(TICK_MS);
    }
  };
  /** Until the room we are in has placed us: a patch arrived and we are connected. */
  const placed = async (what: string) => {
    const start = Date.now();
    while (!(net.connected && net.lastServerTick > 0)) {
      if (Date.now() - start > 12000) fail(`hand-off client: ${what}: no patch after 12 s (room "${net.roomName}", handoffs ${net.handoffs})`);
      await sleep(TICK_MS);
    }
  };
  /** Walk east for a second and report how far the server moved us (the reconciled position). */
  const walks = async () => {
    const x0 = net.me.x;
    await drive(1000, () => ({ dx: 1, dy: 0 }));
    await sleep(300);
    return net.me.x - x0;
  };
  try {
    await net.connect(`ws://localhost:${PORT}`, "Wren");
    await placed("village");
    if (net.roomName !== "village") fail(`hand-off client: joined "${net.roomName}", not the village`);
    const portal = VILLAGE.portal!;
    const startAt = Date.now();
    await drive(15000, () => {
      if (net.handoffs > 0) return null;
      const dx = portal.x - net.me.x;
      const dz = portal.z - net.me.z;
      const d = Math.hypot(dx, dz);
      return d < 0.5 ? { dx: 0, dy: 0 } : { dx: dx / Math.max(d, 1), dy: dz / Math.max(d, 1) };
    });
    if (net.handoffs !== 1) fail(`hand-off client: the portal did not move us in 15 s (at ${net.me.x.toFixed(2)}, ${net.me.z.toFixed(2)})`);
    await placed("the Warrens");
    if (net.roomName !== "dungeon" || net.level.id !== WARRENS.id) fail(`hand-off client: arrived in "${net.roomName}" on ${net.level.id}`);
    const inWarrens = await walks();
    if (inWarrens < 3) fail(`hand-off client: after the portal a second east moved us ${inWarrens.toFixed(2)} m`);
    const tookMs = Date.now() - startAt;

    // A seat for a room that does not exist: the server refuses the join.
    const refused = { room: { name: "dungeon", roomId: "no-such-room", processId: "no-such-process" }, sessionId: "no-such-seat" };
    const failStart = Date.now();
    await (net as any).handoff({ reservation: refused, level: WARRENS.id });
    await placed("the fallback");
    const fellBackMs = Date.now() - failStart;
    if (net.handoffFallbacks !== 1 || net.roomName !== "village" || net.level.id !== VILLAGE.id)
      fail(`hand-off client: a refused seat left us in "${net.roomName}" on ${net.level.id} with ${net.handoffFallbacks} fallbacks`);
    const inVillage = await walks();
    if (inVillage < 3) fail(`hand-off client: after the fallback a second east moved us ${inVillage.toFixed(2)} m`);
    console.log(
      `ok: hand-off client: Net walked through the portal (${tookMs} ms) and moved ${inWarrens.toFixed(2)} m in the Warrens; a refused seat put it in the village in ${fellBackMs} ms, where it moved ${inVillage.toFixed(2)} m`
    );
  } finally {
    net.dispose();
    await sleep(300);
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

/**
 * The join screen's pick (Michael, A, 2026-10-05): a weapon and tier sent as join options reach every client,
 * the server swings with it, and a pick the server does not know is the starter sword at a real tier.
 */
async function weaponPick(client: Client) {
  const f = await client.create("dungeon", { name: "Foxtrot", level: "field", weapon: "claymore", tier: 5 });
  const g = await client.joinById(f.roomId, { name: "Golf", weapon: "laser", tier: 99 });
  let fState: any = null;
  let gState: any = null;
  f.onStateChange((s: any) => (fState = s));
  g.onStateChange((s: any) => (gState = s));
  await sleep(400);
  if (!fState || !gState) fail("weapon pick: no state received");
  const fox = gState.players.get(f.sessionId);
  const golf = fState.players.get(g.sessionId);
  if (fox?.weaponType !== "claymore" || fox?.weaponTier !== 5) fail(`weapon pick: Golf sees Foxtrot with ${fox?.weaponType} ${fox?.weaponTier}, not claymore 5`);
  if (golf?.weaponType !== "sword" || golf?.weaponTier !== 1) fail(`weapon pick: a bad pick became ${golf?.weaponType} ${golf?.weaponTier}, not sword 1`);
  f.send("input", { seq: 1, dx: 0, dy: 0, attack: true, dodge: false });
  await sleep(300);
  const swung = fState.players.get(f.sessionId);
  const two = WEAPON_CLASSES.twoHand;
  if (swung.attackUntil - swung.attackHitAt !== two.durationMs - two.windupMs) {
    fail(`weapon pick: Foxtrot's swing recovers in ${swung.attackUntil - swung.attackHitAt} ms, not the two-hander's ${two.durationMs - two.windupMs}`);
  }
  console.log("ok: weapon pick: a Claymore at tier 5 reaches both clients and swings two-handed; an unknown pick is a tier-1 sword");

  await g.leave();
  await f.leave();
  await sleep(300);
}

/**
 * Sprint and jump (Michael, 2026-10-15, 1A 2A): India sprints east for twenty ticks, then jumps from the
 * sprint and lets go of the stick. Juliet sees the landing time and the carried speed; the hop lands
 * the takeoff speed times the air time further on, walls permitting (the open field has none near).
 */
async function jumpSprint(client: Client) {
  const i = await client.create("dungeon", { name: "India", level: "field" });
  const j = await client.joinById(i.roomId, { name: "Juliet" });
  let iState: any = null;
  let jState: any = null;
  i.onStateChange((s: any) => (iState = s));
  j.onStateChange((s: any) => (jState = s));
  await sleep(400);
  if (!iState || !jState) fail("jump/sprint: no state received");
  const x0 = iState.players.get(i.sessionId).x;
  let seq = 0;
  for (let k = 0; k < 20; k++) {
    i.send("input", { seq: ++seq, dx: 1, dy: 0, attack: false, dodge: false, sprint: true });
    await sleep(TICK_MS);
  }
  await sleep(300);
  const ran = iState.players.get(i.sessionId);
  const sprintM = ran.x - x0;
  const want = 20 * PLAYER.speed * PLAYER.sprintMult * (TICK_MS / 1000);
  if (ran.lastSeq !== seq || Math.abs(sprintM - want) > 0.01) fail(`jump/sprint: 20 sprinting ticks moved India ${sprintM.toFixed(2)} m (seq ${ran.lastSeq} of ${seq}), not ${want.toFixed(2)}`);

  const xJump = ran.x;
  i.send("input", { seq: ++seq, dx: 1, dy: 0, attack: false, dodge: false, sprint: true, jump: true });
  for (let k = 1; k < PLAYER.jumpMs / TICK_MS + 4; k++) {
    await sleep(TICK_MS);
    i.send("input", { seq: ++seq, dx: 0, dy: 0, attack: false, dodge: false });
  }
  await sleep(100);
  const seen = jState.players.get(i.sessionId);
  const truth = iState.players.get(i.sessionId);
  if (!(seen.jumpUntil > 0) || seen.jumpUntil !== truth.jumpUntil) fail(`jump/sprint: Juliet sees India's landing at ${seen.jumpUntil}, the server has ${truth.jumpUntil}`);
  const vx = PLAYER.speed * PLAYER.sprintMult;
  if (Math.abs(seen.jumpVx - vx) > 1e-9) fail(`jump/sprint: the carried speed is ${seen.jumpVx}, not ${vx}`);
  const hop = truth.x - xJump;
  // The takeoff frame still holds the stick, so it steers one tick on top of the carried speed.
  const wantHop = vx * (PLAYER.jumpMs / 1000) + PLAYER.speed * PLAYER.jumpSteer * (TICK_MS / 1000);
  if (Math.abs(hop - wantHop) > 0.01) fail(`jump/sprint: the hop from a sprint carried India ${hop.toFixed(2)} m, not ${wantHop.toFixed(2)}`);
  console.log(`ok: jump/sprint: 20 sprinting ticks ${sprintM.toFixed(2)} m; a sprint jump carried ${hop.toFixed(2)} m and Juliet saw its landing time and speed`);
  await j.leave();
  await i.leave();
  await sleep(300);
}

/**
 * The bow's lock-on, alone in a fresh field: Hotel spawns at (-3, 3), 17 m from the goblin at (9, -9), so a
 * press finds nothing; after walking a second toward it a press locks it, and the next goes back to auto.
 */
async function lockOn(client: Client) {
  const h = await client.create("dungeon", { name: "Hotel", level: "field", weapon: "bow", tier: 1 });
  let hState: any = null;
  h.onStateChange((s: any) => (hState = s));
  const hEvents: any[] = [];
  h.onMessage("events", (evs: any[]) => hEvents.push(...evs));
  let hseq = 0;
  const press = async () => {
    h.send("input", { seq: ++hseq, dx: 0, dy: 0, attack: false, dodge: false, cycle: true });
    await sleep(300);
    return hState.players.get(h.sessionId);
  };
  await sleep(300);
  const far = await press();
  if (far.lockId !== "") fail(`lock-on: Hotel at (${far.x}, ${far.z}) locked "${far.lockId}" with nothing in range`);
  for (let i = 0; i < 20; i++) {
    h.send("input", { seq: ++hseq, dx: 0.707, dy: -0.707, attack: false, dodge: false });
    await sleep(TICK_MS);
  }
  const goblinId = [...hState.enemies.keys()][0];
  const near = await press();
  const gob = hState.enemies.get(goblinId);
  const d = Math.hypot(gob.x - near.x, gob.z - near.z);
  if (near.lockId !== goblinId) fail(`lock-on: ${d.toFixed(1)} m from the goblin Hotel's lock is "${near.lockId}", not ${goblinId}`);
  // Arrow rain on the lock: it lands on the goblin wherever it has walked to.
  h.send("input", { seq: ++hseq, dx: 0, dy: 0, attack: false, dodge: false, ability: 1 });
  await sleep(1000);
  const volley = hEvents.find((e) => e.kind === "arrowRain");
  const rained = hEvents.find((e) => e.kind === "abilityHit" && e.ability === "arrowRain" && e.enemyId === goblinId);
  if (!volley || !rained) fail(`arrow rain: ${volley ? `fell at (${volley.x.toFixed(1)}, ${volley.z.toFixed(1)}) and hit ${volley.hits}` : "never fell"}, expected it on the locked goblin`);
  const again = await press();
  if (again.lockId !== "") fail(`lock-on: a second press with one target left the lock on "${again.lockId}"`);
  console.log(`ok: lock-on: nothing in range at 17 m, the goblin locked at ${d.toFixed(1)} m, Arrow rain on it for ${rained.damage}, back to auto on the next press`);
  await h.leave();
  await sleep(300);
}

/** The Warrens floor (`?level=warrens`): its enemies arrive asleep, the stairs shut. */
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
  if (wState.stairsOpen !== false) fail(`warrens: stairs ${wState.stairsOpen}`);
  console.log(`ok: warrens room has ${wState.enemies.size} enemies asleep in their rooms, stairs shut`);
  await w.leave();
  await sleep(300);
}

/**
 * The two-player combo (Michael, A, 2026-10-05): in a cellar Mira cleaves the goblin (Staggered), then Nell's
 * Execute consumes it. Both clients must get a "combo" event, x1.5 from two players, for the callout.
 */
async function combo(client: Client) {
  const m = await client.create("dungeon", { name: "Mira", level: "cellar" });
  const n = await client.joinById(m.roomId, { name: "Nell" });
  let mState: any = null;
  m.onStateChange((s: any) => (mState = s));
  const mEvents: any[] = [];
  const nEvents: any[] = [];
  m.onMessage("events", (evs: any[]) => mEvents.push(...evs));
  n.onMessage("events", (evs: any[]) => nEvents.push(...evs));
  await sleep(400);
  if (!mState || mState.enemies.size !== 1) fail(`combo: cellar has ${mState?.enemies.size} enemies`);
  let mseq = 0;
  let nseq = 0;
  // Each steps up to the goblin and faces it; Mira presses Cleave, Nell Execute once Cleave has landed.
  const press = (room: any, nextSeq: () => number, slot: number) => {
    const me = mState.players.get(room.sessionId);
    const e = nearestEnemy(mState, me.x, me.z);
    if (!e) return;
    const d = Math.hypot(e.x - me.x, e.z - me.z);
    if (d > 1.9) return stepToward(room, mState, nextSeq, e.x, e.z, 1.4);
    const f = 0.01 / d;
    room.send("input", { seq: nextSeq(), dx: (e.x - me.x) * f, dy: (e.z - me.z) * f, attack: false, dodge: false, ability: slot });
  };
  const start = Date.now();
  const cleaved = () => mEvents.some((x) => x.kind === "abilityHit" && x.ability === "cleave" && x.attackerId === m.sessionId);
  const bots = setInterval(() => {
    press(m, () => ++mseq, cleaved() ? 0 : 1);
    press(n, () => ++nseq, cleaved() ? 2 : 0);
  }, TICK_MS);
  const isCombo = (x: any) => x.kind === "combo" && x.attackerId === n.sessionId;
  while (!(mEvents.some(isCombo) && nEvents.some(isCombo)) && Date.now() - start < 15000) await sleep(50);
  clearInterval(bots);
  const seen = [mEvents.find(isCombo), nEvents.find(isCombo)];
  if (seen.some((x) => !x)) fail(`combo: Mira saw ${JSON.stringify(seen[0])}, Nell ${JSON.stringify(seen[1])}; events ${JSON.stringify(mEvents.map((x) => x.kind))}`);
  const c = seen[0];
  if (c.payoff !== "crit" || c.contributors !== 2 || c.mult !== 1.5) fail(`combo: expected a two-player crit x1.5, got ${JSON.stringify(c)}`);
  const exec = mEvents.find((x) => x.kind === "abilityHit" && x.ability === "execute");
  console.log(`ok: combo: Mira's Cleave then Nell's Execute, Combo x${c.mult} from ${c.contributors} players for ${exec?.damage} on both clients ${Date.now() - start} ms after setting off`);
  await m.leave();
  await n.leave();
  await sleep(300);
}

/** Walk `room`'s player (as `state` sees them) toward (tx, tz) one tick, stopping within `stopAt`; extra flags ride along. */
function stepToward(room: any, state: any, nextSeq: () => number, tx: number, tz: number, stopAt: number, extra: Record<string, unknown> = {}) {
  const me = state.players.get(room.sessionId);
  const vx = tx - me.x;
  const vz = tz - me.z;
  const d = Math.hypot(vx, vz);
  const k = d > stopAt ? 1 / d : 0;
  room.send("input", { seq: nextSeq(), dx: vx * k, dy: vz * k, attack: false, dodge: false, ...extra });
}

/** Wait for a "handoff" message on each room, in the order given; fails after `timeoutMs`. */
async function handoffs(rooms: any[], timeoutMs: number): Promise<any[]> {
  const got: any[] = rooms.map(() => null);
  rooms.forEach((r, i) => r.onMessage("handoff", (m: any) => (got[i] = m)));
  const start = Date.now();
  while (got.some((m) => m === null) && Date.now() - start < timeoutMs) await sleep(50);
  return got;
}

/**
 * The village and the portal. Ivy and Juno join a village room: no enemies, the village's level,
 * both players. Ivy walks to Keeper Wren and presses use: an npcTalk event names them both. Then
 * both walk onto the portal and stand: within PORTAL.holdMs of the second arriving, each gets a
 * "handoff" with a seat in the same fresh dungeon room on the Warrens; consuming it lands them
 * there together, Juno still with her bow, and the village room has let them go.
 */
async function village(client: Client) {
  const a = await client.create("village", { name: "Ivy" });
  const b = await client.joinById(a.roomId, { name: "Juno", weapon: "bow", tier: 2 });
  let aState: any = null;
  let bState: any = null;
  a.onStateChange((s: any) => (aState = s));
  b.onStateChange((s: any) => (bState = s));
  const aEvents: any[] = [];
  a.onMessage("events", (evs: any[]) => aEvents.push(...evs));
  await sleep(400);
  if (!aState || !bState) fail("village: no state received");
  if (aState.levelId !== VILLAGE.id || aState.enemies.size !== 0 || bState.players.size !== 2) {
    fail(`village: expected ${VILLAGE.id} with no enemies and 2 players, got ${aState.levelId}, ${aState.enemies.size} enemies, ${bState.players.size} players`);
  }

  // The keeper: walk up and press use once in reach.
  const keeper = VILLAGE.npcs![0];
  let aseq = 0;
  let bseq = 0;
  const talkStart = Date.now();
  const talker = setInterval(() => {
    const me = aState.players.get(a.sessionId);
    const near = Math.hypot(me.x - keeper.x, me.z - keeper.z) <= NPC.talkRange - 0.3;
    stepToward(a, aState, () => ++aseq, keeper.x, keeper.z, NPC.talkRange - 0.5, near ? { use: true } : {});
  }, TICK_MS);
  while (!aEvents.some((e) => e.kind === "npcTalk") && Date.now() - talkStart < 8000) await sleep(50);
  clearInterval(talker);
  const talk = aEvents.find((e) => e.kind === "npcTalk");
  if (!talk || talk.npcId !== keeper.id || talk.playerId !== a.sessionId) fail(`village: no talk with ${keeper.name} (${JSON.stringify(talk)})`);
  const talkedIn = Date.now() - talkStart;

  // The portal: both walk onto it and stand.
  const portal = VILLAGE.portal!;
  const walkers = setInterval(() => {
    stepToward(a, aState, () => ++aseq, portal.x, portal.z, 0.8);
    stepToward(b, aState, () => ++bseq, portal.x, portal.z, 0.8);
  }, TICK_MS);
  const holdStart = Date.now();
  const got = await handoffs([a, b], 15000);
  clearInterval(walkers);
  if (got.some((m) => m === null)) fail(`village: handoff reached ${got.filter(Boolean).length} of 2 clients after ${Date.now() - holdStart} ms (portalMs ${aState.portalMs})`);
  const [ha, hb] = got;
  if (ha.level !== portal.to || hb.level !== portal.to) fail(`village: handoff level ${ha.level}, ${hb.level}, expected ${portal.to}`);
  if (ha.reservation.room.name !== "dungeon" || ha.reservation.room.roomId !== hb.reservation.room.roomId) {
    fail(`village: seats in ${ha.reservation.room.name} ${ha.reservation.room.roomId} and ${hb.reservation.room.name} ${hb.reservation.room.roomId}, expected one dungeon room`);
  }
  await a.leave();
  await b.leave();
  const a2 = await client.consumeSeatReservation(ha.reservation);
  const b2 = await client.consumeSeatReservation(hb.reservation);
  let a2State: any = null;
  a2.onStateChange((s: any) => (a2State = s));
  await sleep(500);
  if (!a2State || a2State.levelId !== WARRENS.id || a2State.enemies.size !== WARRENS.enemies.length || a2State.players.size !== 2) {
    fail(`village: after the portal, ${a2State?.levelId} with ${a2State?.enemies.size} enemies and ${a2State?.players.size} players`);
  }
  const juno = a2State.players.get(b2.sessionId);
  if (juno?.name !== "Juno" || juno.weaponType !== "bow" || juno.weaponTier !== 2) fail(`village: Juno arrived as ${juno?.name} with ${juno?.weaponType} ${juno?.weaponTier}`);
  console.log(
    `ok: village: ${VILLAGE.npcs!.length} villagers, ${keeper.name} answered in ${talkedIn} ms; the portal handed Ivy and Juno to dungeon ${a2.roomId.slice(0, 6)} on ${ha.level} ${Date.now() - holdStart} ms after they set off, both there with their weapons`
  );
  await a2.leave();
  await b2.leave();
  await sleep(300);
}

/**
 * The stairs: Kit and Lark in a cellar (one goblin, the stairs at the middle). Kit walks to the
 * goblin and swings until it falls; the stairs open; both stand on them and are handed seats in one
 * village room, where they arrive together with no enemies.
 */
async function stairsBack(client: Client) {
  const k = await client.create("dungeon", { name: "Kit", level: "cellar" });
  const l = await client.joinById(k.roomId, { name: "Lark" });
  let kState: any = null;
  k.onStateChange((s: any) => (kState = s));
  await sleep(400);
  if (!kState || kState.levelId !== CELLAR.id || kState.enemies.size !== 1) fail(`cellar: got ${kState?.levelId} with ${kState?.enemies.size} enemies`);
  let kseq = 0;
  let lseq = 0;
  const fightStart = Date.now();
  const fighter = setInterval(() => {
    const me = kState.players.get(k.sessionId);
    const e = nearestEnemy(kState, me.x, me.z);
    if (!e) return;
    const d = Math.hypot(e.x - me.x, e.z - me.z);
    if (d > 1.8) return stepToward(k, kState, () => ++kseq, e.x, e.z, 1.4);
    // Face it with a tiny step and swing.
    const f = 0.01 / d;
    k.send("input", { seq: ++kseq, dx: (e.x - me.x) * f, dy: (e.z - me.z) * f, attack: true, dodge: false });
  }, TICK_MS);
  while (!kState.stairsOpen && Date.now() - fightStart < 20000) await sleep(50);
  clearInterval(fighter);
  if (!kState.stairsOpen) fail(`cellar: the stairs never opened (goblin ${JSON.stringify(nearestEnemy(kState, 0, 0)?.hp)} hp)`);
  const fought = Date.now() - fightStart;
  const stairs = CELLAR.stairs!;
  const walkers = setInterval(() => {
    stepToward(k, kState, () => ++kseq, stairs.x, stairs.z, 0.8);
    stepToward(l, kState, () => ++lseq, stairs.x, stairs.z, 0.8);
  }, TICK_MS);
  const holdStart = Date.now();
  const got = await handoffs([k, l], 15000);
  clearInterval(walkers);
  if (got.some((m) => m === null)) fail(`cellar: handoff reached ${got.filter(Boolean).length} of 2 clients after ${Date.now() - holdStart} ms (descendMs ${kState.descendMs} of ${STAIRS.holdMs})`);
  const [hk, hl] = got;
  if (hk.level !== VILLAGE.id || hk.reservation.room.name !== "village" || hk.reservation.room.roomId !== hl.reservation.room.roomId) {
    fail(`cellar: seats in ${hk.reservation.room.name} ${hk.reservation.room.roomId} and ${hl.reservation.room.name} ${hl.reservation.room.roomId} (${hk.level})`);
  }
  await k.leave();
  await l.leave();
  const k2 = await client.consumeSeatReservation(hk.reservation);
  const l2 = await client.consumeSeatReservation(hl.reservation);
  let k2State: any = null;
  k2.onStateChange((s: any) => (k2State = s));
  await sleep(500);
  if (!k2State || k2State.levelId !== VILLAGE.id || k2State.enemies.size !== 0 || k2State.players.size !== 2) {
    fail(`cellar: after the stairs, ${k2State?.levelId} with ${k2State?.enemies.size} enemies and ${k2State?.players.size} players`);
  }
  if (k2State.portalMs !== 0 || k2State.players.get(k2.sessionId).name !== "Kit") fail("cellar: the village they came back to is not fresh, or Kit lost their name");
  console.log(`ok: cellar: the goblin fell in ${fought} ms and the stairs opened; they handed Kit and Lark to village ${k2.roomId.slice(0, 6)} ${Date.now() - holdStart} ms after they set off`);
  await k2.leave();
  await l2.leave();
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
