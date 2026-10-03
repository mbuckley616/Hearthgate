/**
 * Netcode smoke test that needs no browser.
 *
 * Boots the server on a spare port, joins two colyseus.js clients, drives one
 * of them with inputs for a second, and checks that:
 *   1. both clients see two players;
 *   2. the driven player moved on the server and the other client saw it;
 *   3. the goblin left idle and started chasing.
 *
 * Run: npm run test:net
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "colyseus.js";
import { TICK_MS } from "@hearthgate/shared";

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
