/**
 * Netcode smoke test that needs no browser.
 *
 * Boots the server on a spare port, joins two colyseus.js clients, drives one
 * of them with inputs for a second, and checks that:
 *   1. both clients see two players;
 *   2. the driven player moved on the server and the other client saw it;
 *   3. the goblin left idle and started chasing;
 *   4. a third client flooding inputs at 80 a second is dropped, and the others stay.
 *
 * Run: npm run test:net
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "colyseus.js";
import { DOWNS, TICK_MS } from "@hearthgate/shared";

const PORT = 2599;

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
    const a = await client.joinOrCreate("dungeon", { name: "Alpha" });
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
    if (bState.enemy.phase === "idle") fail("goblin never aggroed");

    console.log(
      `ok: 2 players synced, Alpha moved ${moved.toFixed(2)} m, Bravo sees x=${aOnB.x.toFixed(2)}, goblin is ${bState.enemy.phase}, server tick ${aState.tick}`
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
      const e = aState.enemy;
      walkTo(b, () => ++bseq, e.x, e.z, 1.2);
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

    await a.leave();
    await b.leave();
  } finally {
    server.kill("SIGTERM");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAIL:", err.message ?? err);
    process.exit(1);
  });
