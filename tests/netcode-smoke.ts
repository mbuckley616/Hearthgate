/**
 * Netcode smoke test that needs no browser: the combat slice's fight on Hearthgate's server,
 * spoken to by bots (tests/bots.ts) and by the real ClientSession.
 *
 * Boots the server on a spare port (a dev build, so the cheats work) and checks that:
 *   1. a bot makes a fight: a four-letter code, welcomed as p1, the tuning set, snapshots 30 a second;
 *   2. a second bot joins by the code as p2 and both see two players;
 *   3. a driven bot moves on the server, the other sees it, and every input is acked;
 *   4. the party walks through the antechamber gate and the run starts: intro, then wave 1's enemies;
 *   5. garbage, a wrong build's hello and a code that does not exist hurt nobody;
 *   6. a bot flooding commands is dropped with 4001 and the others keep their snapshots;
 *   7. a tuning edit reaches the other player, and debug slow motion slows the server's clock;
 *   8. the dev cheats: skip to the Warden;
 *   9. the real ClientSession (the browser's) runs, sprints and dodges for three seconds with no
 *      snap and ends exactly where the server has it;
 *  10. stress: four bots fight in a fresh room for STRESS_MS; every input is applied, nobody is
 *      dropped, snapshots keep coming at 30 a second and the fight keeps wall time.
 *
 * Run: npm run test:net
 */
import { arena, buildWorld } from "@hearthgate/shared/level/arena";
import { tuning, tuningDefaults } from "@hearthgate/shared/config/tuning";
import { ClientSession } from "../client/src/game/ClientSession";
import { Bot, MSG, TICK_MS, bootServer, command, loadout, sleep, waitForHealth } from "./bots";

const PORT = 2599;
const ENDPOINT = `ws://127.0.0.1:${PORT}`;
const STRESS_MS = Number(process.env.STRESS_MS ?? 5000);

let failures = 0;
function check(ok: boolean, what: string, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const server = bootServer(PORT);
  const bots: Bot[] = [];
  try {
    await waitForHealth(`http://127.0.0.1:${PORT}/health`);
    const bot = async (name: string, code: string | null) => {
      const b = await new Bot(name, ENDPOINT).join(code);
      bots.push(b);
      return b;
    };

    // 1. A fight of our own.
    const a = await bot("Alpha", null);
    check(/^[A-HJ-NP-Z2-9]{4}$/.test(a.code), "a fight gets a four-letter code", a.code);
    check(a.id === "p1", "the first player is p1", a.id);
    check(a.messages.some((m) => m.k === "tuning"), "the tuning set arrives with the welcome");
    const n0 = a.snaps.length;
    await sleep(1000);
    const rate = a.snaps.length - n0;
    check(rate >= 27 && rate <= 33, "snapshots arrive 30 a second", `${rate} in 1 s`);

    // 2. A friend joins by the code.
    const b = await bot("Bravo", a.code);
    check(b.id === "p2", "the second player is p2", b.id);
    await a.until(() => a.state.players.length === 2, 2000, "Alpha sees two players");
    check(b.state.players.length === 2, "both see two players");

    // 3. Movement through the server.
    const z0 = b.me("p1")!.z;
    await a.drive(60, () => command({ moveX: 1 }));
    await a.drive(20);
    await sleep(300);
    const moved = b.me("p1")!.x - a.state.players.find((p) => p.id === "p1")!.x;
    check(Math.abs(moved) < 1e-9, "both players' snapshots agree on Alpha");
    check(b.me("p1")!.x > 3, "Alpha ran east on the server and Bravo saw it", `${b.me("p1")!.x.toFixed(2)} m east, z ${z0.toFixed(2)}`);
    // The server stands in for a quiet player's missing inputs for up to 18 ticks and acks them (inputSlots.ts), so once
    // a bot stops sending, the ack runs a little past its last input.
    check(a.ack >= a.seq && a.ack <= a.seq + 18, "every input Alpha sent was used and acked", `ack ${a.ack} of ${a.seq}`);

    // 4. Through the gate together: the run starts.
    const entryZ = arena.arenaEntryZ;
    await Promise.all([a.drive(240, () => command({ moveZ: -1, moveX: -0.3 })), b.drive(240, () => command({ moveZ: -1 }))]);
    await a.until(() => a.state.run.phase !== "ante", 3000, "the run starts");
    check(a.state.run.phase !== "ante" && a.state.run.gateClosed, "the party went through the gate and it closed", `phase ${a.state.run.phase}, z ${a.me()!.z.toFixed(1)} < ${entryZ}`);
    await a.until(() => a.state.run.phase === "wave" && a.state.enemies.length > 0, tuning.run.introMs + 2000, "wave 1");
    check(true, "wave 1 arrives", `${a.state.enemies.length} enemies`);

    // 5. Garbage hurts nobody.
    const cc = new (await import("colyseus.js")).Client(ENDPOINT);
    const raw = await cc.joinById(a.code);
    const said: unknown[] = [];
    raw.onMessage(MSG, (m) => said.push(m));
    raw.send(MSG, { k: "hello", version: 1, loadout: loadout("old") });
    raw.send(MSG, { k: "input", cmds: "lots" });
    raw.send(MSG, { k: "hello", version: 2, loadout: { name: 5 } });
    raw.send(MSG, "nonsense");
    raw.send("other", { k: "hello" });
    const before = a.snaps.length;
    await sleep(500);
    check(said.some((m) => (m as { k: string }).k === "refused"), "a wrong build's hello is refused politely");
    check(a.snaps.length - before > 10 && a.state.players.length === 2, "garbage does not stop the fight or add a player");
    // The server may have closed it already (the unknown message type); leave() then never answers.
    await Promise.race([raw.leave(), sleep(1000)]);
    let badCode = "";
    try {
      await new Bot("Nobody", ENDPOINT).join("ZZZZ");
    } catch (err) {
      badCode = (err as Error).message;
    }
    check(badCode !== "", "a code that does not exist is refused", badCode.slice(0, 60));

    // 6. A flood is dropped.
    const d = await bot("Flood", a.code);
    const floodStart = performance.now();
    for (let i = 0; i < 40 && d.closedWith === null; i++) {
      const cmds = Array.from({ length: 10 }, () => ({ seq: ++d.seq, cmd: command() }));
      d.send({ k: "input", cmds });
      await sleep(25);
    }
    await d.until(() => d.closedWith !== null, 3000, "the flood is dropped");
    check(d.closedWith === 4001, "a client sending 400 commands a second is dropped with 4001", `after ${Math.round(performance.now() - floodStart)} ms`);
    const afterFlood = a.snaps.length;
    await sleep(300);
    check(a.snaps.length > afterFlood && a.state.players.length === 2, "the others keep playing");

    // 7. Tuning through the server, and slow motion.
    const run = tuningDefaults.movement.runSpeed;
    a.send({ k: "tune", edit: { path: "movement.runSpeed", value: run + 1 } });
    await b.until(() => b.messages.some((m) => m.k === "tuning" && m.edits["movement.runSpeed"] === run + 1), 2000, "Bravo hears the edit");
    check(true, "a tuning edit reaches the other player");
    a.send({ k: "tune", edit: { path: "movement.runSpeed", value: run } });
    a.send({ k: "tune", edit: { path: "debug.slowMo", value: true } });
    await a.until(() => a.snaps[a.snaps.length - 1].scale === tuning.debug.slowMoScale, 2000, "slow motion");
    const t0 = a.state.tick;
    await sleep(2000);
    const slowRate = (a.state.tick - t0) / 2;
    check(Math.abs(slowRate - 60 * tuning.debug.slowMoScale) < 3, "slow motion runs the server at its scale", `${slowRate.toFixed(1)} ticks a second`);
    a.send({ k: "tune", edit: { path: "debug.slowMo", value: false } });
    await a.until(() => a.snaps[a.snaps.length - 1].scale === 1, 2000, "full speed");

    // 8. The dev cheats.
    a.send({ k: "cheat", cheat: "warden" });
    await a.until(() => a.state.run.wave === 4, 2000, "the Warden");
    check(a.state.enemies.some((e) => e.kind === "warden"), "skip to the Warden spawns it");
    for (const x of bots) await x.leave();
    bots.length = 0;

    // 9. The browser's own ClientSession, solo.
    const world = buildWorld(arena);
    const cs = new ClientSession(world, null, loadout("Delta"), ENDPOINT);
    const start = performance.now();
    while (!cs.playing) {
      if (performance.now() - start > 5000) throw new Error("ClientSession never started");
      await sleep(5);
    }
    let last = performance.now();
    const t1 = performance.now();
    while (performance.now() - t1 < 4000) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const el = now - t1;
      const going = el < 3000;
      cs.advance(
        command({ moveX: going ? Math.sin(el / 600) : 0, moveZ: going ? -Math.abs(Math.cos(el / 600)) : 0, sprint: el > 1000 && el < 2000, dodge: going && Math.floor(el / 16) % 70 === 0, jump: going && Math.floor(el / 16) % 97 === 0 }),
        dt,
      );
      await sleep(Math.max(1, TICK_MS / 2));
    }
    const hero = cs.hero()!.curr;
    const lastSnap = cs.view().curr.players.find((p) => p.id === cs.localId)!;
    check(cs.stats.snaps === 0, "the ClientSession never snapped", `${cs.stats.snapshots} snapshots, ${cs.stats.corrections} corrections, largest ${cs.stats.maxCorrection.toFixed(3)} m`);
    check(Math.hypot(hero.x - lastSnap.x, hero.z - lastSnap.z) < 1e-6, "standing still, it is drawn exactly where the server has it", `${hero.x.toFixed(3)}, ${hero.z.toFixed(3)}`);

    // 10. Stress.
    const s1 = await bot("S1", null);
    const party = [s1, await bot("S2", s1.code), await bot("S3", s1.code), await bot("S4", s1.code)];
    const ticksAt = s1.state.tick;
    const wallAt = performance.now();
    const snapsAt = s1.snaps.length;
    const ticks = Math.round(STRESS_MS / TICK_MS);
    await Promise.all(
      party.map((p, i) =>
        p.drive(ticks, (k) => command({ moveX: Math.cos(k / 50 + i), moveZ: Math.sin(k / 50 + i), attack: k % 23 === i, dodge: k % 97 === i * 7, block: k % 200 > 180 })),
      ),
    );
    await sleep(300);
    const wall = (performance.now() - wallAt) / 1000;
    const tickRate = (s1.state.tick - ticksAt) / wall;
    const snapRate = (s1.snaps.length - snapsAt) / wall;
    check(party.every((p) => p.closedWith === null), "nobody is dropped under load");
    check(party.every((p) => p.ack >= p.seq && p.ack <= p.seq + 18), "every input is used", party.map((p) => `${p.ack}/${p.seq}`).join(" "));
    check(Math.abs(tickRate - 60) < 2, "the fight keeps wall time", `${tickRate.toFixed(1)} ticks a second`);
    check(snapRate > 28, "snapshots keep coming", `${snapRate.toFixed(1)} a second`);
    const bytes = JSON.stringify(s1.state).length;
    console.log(`      a four-player snapshot is ${(bytes / 1024).toFixed(1)} KB as JSON`);
    for (const p of party) await p.leave();
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    for (const x of bots) await x.leave().catch(() => {});
    server.kill();
  }
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

void main();
