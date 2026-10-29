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
 *   8c. a hand-built dungeon (T4b): a bot asks Keeper Wren for one, a broken layout is refused, the
 *      ring is labelled with it and leads onto its first floor, the pair walk it to its rest room, and
 *      the deeper ring takes them onto its own second floor, not a generated one;
 *   9. the real ClientSession (the browser's) runs, sprints and dodges for three seconds with no
 *      snap and ends exactly where the server has it;
 *   9b. the real ClientSession on a generated floor (T4): it builds the floor the server sent, and its
 *      predicted hero walks to a room at another height, up or down a staircase, with no snap;
 *   8b. the village, the portal and a generated run (T3, T4): two bots make a village and walk into its
 *      ring together, are handed onto floor 1 of a generated run, walk it from the entrance to the rest
 *      room (clearing each fight room that shuts behind them with the dev cheats), bank their drops,
 *      take the deeper ring onto floor 2, walk that one too and take its ring home to the same village;
 *  10. stress: four bots fight in a fresh room for STRESS_MS; every input is applied, nobody is
 *      dropped, snapshots keep coming at 30 a second and the fight keeps wall time.
 *
 * Run: npm run test:net
 */
import { arena } from "@hearthgate/shared/level/arena";
import { village } from "@hearthgate/shared/level/village";
import { floorLevel, insidePiece, walkRoute, type FloorLayout } from "@hearthgate/shared/level/floor";
import { floorSeed } from "@hearthgate/shared/level/generate";
import { emptyVillage, upgradeCost, type VillageSave } from "@hearthgate/shared/game/villageSave";
import { DUNGEONS } from "@hearthgate/shared/level/dungeons";
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
    const bot = async (name: string, code: string | null, create: "dungeon" | "village" = "dungeon", village: VillageSave | null = null) => {
      const b = new Bot(name, ENDPOINT);
      b.village = village;
      await b.join(code, create);
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

    // 7b. What a hero wears reaches every player (T5c), and a look the catalogue does not know is dropped.
    const look = ["iron-fullHelm", "black-platebody", "steel-sword"];
    a.send({ k: "loadout", loadout: { ...loadout("Alpha"), look } });
    await b.until(() => b.me(a.id)?.look?.join() === look.join(), 2000, "Bravo sees Alpha's gear");
    check(true, "a worn look reaches the other player in the snapshot", look.join(", "));
    a.send({ k: "loadout", loadout: { ...loadout("Alpha"), look: ["mithril-platebody"] } });
    await sleep(300);
    check(b.me(a.id)?.look?.join() === look.join(), "a look the catalogue does not know is dropped whole");

    // 8. The dev cheats.
    a.send({ k: "cheat", cheat: "warden" });
    await a.until(() => a.state.run.wave === 4, 2000, "the Warden");
    check(a.state.enemies.some((e) => e.kind === "warden"), "skip to the Warden spawns it");
    for (const x of bots) await x.leave();
    bots.length = 0;

    // 8b. The village, its ring into a generated run, two floors walked, and home.
    // Each brings a village save of their own (P2); the room is Vale's, who made it.
    const valeVillage = { ...emptyVillage("vale-test"), lumber: 100, stone: 80 };
    const va = await bot("Vale", null, "village", valeVillage);
    const vb = await bot("Wren", va.code, "village", { ...emptyVillage("wren-test"), lumber: 99 });
    const home = va.code;
    await vb.until(() => vb.lastVillage() !== undefined, 2000, "Wren is told whose village");
    check(
      va.lastVillage()?.yours === true && va.lastVillage()?.village.lumber === 100 && vb.lastVillage()?.yours === false && vb.lastVillage()?.host === "Vale" && vb.lastVillage()?.village.lumber === 100,
      "the village is its maker's save: theirs to keep, shown to a visitor as the host's",
      JSON.stringify({ vale: va.lastVillage(), wren: vb.lastVillage() }),
    );
    check(va.kind === "village" && va.state.enemies.length === 0 && va.state.run.phase === "ante", "a village: no enemies, no run", `code ${home}`);
    check(va.snaps[va.snaps.length - 1].portals[0]?.to === "dungeon", "the village's ring is open and leads into a dungeon");
    // Small floors from a fixed seed, so the walk is short and the same every time.
    va.send({ k: "tune", edit: { path: "dungeon.pieces", value: 12 } });
    va.send({ k: "tune", edit: { path: "dungeon.seed", value: 4242 } });
    const ring = village.village!.portal;
    // Round the well (it stands between the spawn and the shrine), then into the ring.
    await Promise.all([va.walkTo(-3.2, 2, 1), vb.walkTo(3.2, 2, 1)]);
    // Anywhere well inside the 2.4 m ring will do: a looser mark than a spot, so a slow runner settles on it.
    await Promise.all([va.walkTo(ring.x - 0.6, ring.z, 1.5), vb.walkTo(ring.x + 0.6, ring.z, 1.5)]);
    await Promise.all([va.until(() => va.handoff !== null, 5000, "Vale's hand-off"), vb.until(() => vb.handoff !== null, 5000, "Wren's hand-off")]);
    check(va.handoff?.level === "floor" && vb.handoff?.level === "floor", "two seconds in the ring together hand both on to a generated floor");
    await Promise.all([va.takeHandoff(), vb.takeHandoff()]);
    const spec1 = va.floor;
    check(va.kind === "floor" && va.code === vb.code && va.code !== home && spec1?.floor === 1 && spec1.pieces === 12 && spec1.floors === 3, "both arrive on floor 1 of 3 of one run", `${va.code}, ${JSON.stringify(spec1)}`);
    const floor1 = floorLevel(spec1!).dungeon!;
    check(insidePiece(floor1.pieces[floor1.def.entrance], va.me()!.x, va.me()!.z), "the party stands in the floor's entrance");
    const fights1 = await walkFloor(va, vb, floor1);
    check(va.messages.some((m) => m.k === "snap" && m.ev.some((e) => e.kind === "rested")), "reaching the rest room together banks the party's drops");
    const rings = va.snaps[va.snaps.length - 1].portals;
    check(rings.map((r) => r.to).join(",") === "deeper,village", "the rest room has a ring deeper and a ring home", rings.map((r) => r.to).join(","));
    const deeper = rings[0];
    // Anywhere well inside the ring (2.2 m) will do: a tight mark only adds a slow crawl at the end, which a busy CI box can run out of time on.
    await Promise.all([va.walkTo(deeper.x - 0.5, deeper.z, 1.4), vb.walkTo(deeper.x + 0.5, deeper.z, 1.4)]);
    await Promise.all([va.until(() => va.handoff !== null, 5000, "Vale's way deeper"), vb.until(() => vb.handoff !== null, 5000, "Wren's way deeper")]);
    await Promise.all([va.takeHandoff(), vb.takeHandoff()]);
    const spec2 = va.floor;
    check(va.kind === "floor" && va.code === vb.code && spec2?.floor === 2 && spec2.seed !== spec1!.seed, "the deeper ring takes both onto floor 2, a different floor", JSON.stringify(spec2));
    const floor2 = floorLevel(spec2!).dungeon!;
    const fights2 = await walkFloor(va, vb, floor2);
    check(fights1 + fights2 > 0, "fight rooms on the way shut behind the party and open once cleared", `${fights1} + ${fights2} rooms`);
    const homeRing = va.snaps[va.snaps.length - 1].portals.find((r) => r.to === "village")!;
    await Promise.all([va.walkTo(homeRing.x - 0.5, homeRing.z, 1.4), vb.walkTo(homeRing.x + 0.5, homeRing.z, 1.4)]);
    await Promise.all([va.until(() => va.handoff !== null, 5000, "Vale's way home"), vb.until(() => vb.handoff !== null, 5000, "Wren's way home")]);
    await Promise.all([va.takeHandoff(), vb.takeHandoff()]);
    check(va.kind === "village" && va.code === home && vb.code === home, "the ring home takes both to the same village", va.code);
    check(va.state.players.length === 2, "both stand in the village again");
    // What each floor banked (every player's banked event carries the party's lumber and stone).
    const banked = new Map<number, { lumber: number; stone: number }>();
    for (const e of va.events) if (e.kind === "banked") banked.set(e.floor, { lumber: e.lumber, stone: e.stone });
    const grew = [...banked.values()].reduce((s, b) => ({ lumber: s.lumber + b.lumber, stone: s.stone + b.stone }), { lumber: 100, stone: 80 });
    await vb.until(() => vb.lastVillage() !== undefined, 2000, "Wren sees the village again");
    check(
      va.lastVillage()?.yours === true && va.lastVillage()?.village.lumber === grew.lumber && va.lastVillage()?.village.stone === grew.stone && vb.lastVillage()?.village.lumber === grew.lumber && vb.lastVillage()?.yours === false,
      "the run's banks grew the host's village, and both see it",
      `${grew.lumber} lumber, ${grew.stone} stone over ${banked.size} banks`,
    );
    // P4: a visitor cannot spend the host's village; the host raises the store, and both see it.
    const cost = upgradeCost(2);
    vb.send({ k: "upgrade", building: "store", coin: 9999 });
    await vb.drive(10);
    check(vb.lastVillage()?.village.tiers.store === 1 && !vb.messages.some((m) => m.k === "upgraded"), "a visitor's upgrade is refused");
    va.send({ k: "upgrade", building: "store", coin: cost.coin - 1 });
    await va.drive(10);
    check(va.lastVillage()?.village.tiers.store === 1, "the owner's upgrade waits for coin enough");
    va.send({ k: "upgrade", building: "store", coin: cost.coin });
    await va.until(() => va.messages.some((m) => m.k === "upgraded"), 2000, "Vale's store upgrade");
    await vb.until(() => vb.lastVillage()?.village.tiers.store === 2, 2000, "Wren sees the store at tier 2");
    const paid = va.messages.find((m) => m.k === "upgraded");
    check(
      paid?.k === "upgraded" && paid.coin === cost.coin && va.lastVillage()?.village.lumber === grew.lumber - cost.lumber && vb.lastVillage()?.village.stone === grew.stone - cost.stone,
      "the owner raises the store to tier 2: the village pays lumber and stone, the owner the coin, and both see it",
      JSON.stringify(va.lastVillage()?.village),
    );
    va.send({ k: "tune", edit: { path: "dungeon.pieces", value: 0 } });
    va.send({ k: "tune", edit: { path: "dungeon.seed", value: 0 } });
    for (const x of [va, vb]) await x.leave();
    bots.length = 0;

    // 8c. Keeper Wren and a hand-built dungeon.
    const ha = await bot("Hale", null, "village");
    const hb = await bot("Ivy", ha.code, "village");
    const cellar = DUNGEONS.find((d) => d.name === "The Old Cellar")!;
    const broken = { ...cellar, floors: [{ pieces: cellar.floors[0].pieces.filter((p) => p.kind !== "entrance") }, ...cellar.floors.slice(1)] };
    ha.send({ k: "destination", dungeon: broken });
    await ha.drive(30);
    check(ha.snaps[ha.snaps.length - 1].portals[0]?.label === "A new dungeon", "a layout with no entrance is refused: the ring still leads to a new dungeon");
    ha.send({ k: "destination", dungeon: cellar });
    await ha.until(() => ha.snaps[ha.snaps.length - 1].portals[0]?.label === cellar.name, 3000, "the ring's label");
    check(hb.snaps[hb.snaps.length - 1].portals[0]?.label === cellar.name, "asking Keeper Wren turns the ring for the whole party", cellar.name);
    const hRing = village.village!.portal;
    await Promise.all([ha.walkTo(-3.2, 2, 1), hb.walkTo(3.2, 2, 1)]);
    await Promise.all([ha.walkTo(hRing.x - 0.6, hRing.z, 1.5), hb.walkTo(hRing.x + 0.6, hRing.z, 1.5)]);
    await Promise.all([ha.until(() => ha.handoff !== null, 5000, "Hale's hand-off"), hb.until(() => hb.handoff !== null, 5000, "Ivy's hand-off")]);
    await Promise.all([ha.takeHandoff(), hb.takeHandoff()]);
    check(ha.kind === "floor" && ha.floor?.hand?.name === cellar.name && ha.floor.floor === 1 && ha.floor.floors === 2, "the ring leads onto the hand-built dungeon's first floor", JSON.stringify({ floor: ha.floor?.floor, floors: ha.floor?.floors, hand: ha.floor?.hand?.name }));
    const cellarFloor = floorLevel(ha.floor!).dungeon!;
    await walkFloor(ha, hb, cellarFloor);
    const cDeeper = ha.snaps[ha.snaps.length - 1].portals.find((r) => r.to === "deeper")!;
    await Promise.all([ha.walkTo(cDeeper.x - 0.5, cDeeper.z, 1.4), hb.walkTo(cDeeper.x + 0.5, cDeeper.z, 1.4)]);
    await Promise.all([ha.until(() => ha.handoff !== null, 5000, "Hale's way deeper"), hb.until(() => hb.handoff !== null, 5000, "Ivy's way deeper")]);
    await Promise.all([ha.takeHandoff(), hb.takeHandoff()]);
    check(
      ha.floor?.floor === 2 && JSON.stringify(ha.floor.hand?.pieces) === JSON.stringify(cellar.floors[1].pieces),
      "its deeper ring leads onto its own second floor, as laid out",
      JSON.stringify({ floor: ha.floor?.floor, pieces: ha.floor?.hand?.pieces.length }),
    );
    for (const x of [ha, hb]) await x.leave();
    bots.length = 0;

    // 9. The browser's own ClientSession, solo.
    const cs = new ClientSession(null, loadout("Delta"), ENDPOINT, "dungeon");
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

    // 9b. The browser's ClientSession on a generated floor, up or down a staircase. No enemies: this is about the floor.
    const fc = new ClientSession(null, loadout("Echo"), ENDPOINT, "floor", { seed: 777, pieces: 16 });
    const fStart = performance.now();
    while (!fc.playing || !fc.world.level.dungeon) {
      if (performance.now() - fStart > 5000) throw new Error("ClientSession never reached the floor");
      await sleep(5);
    }
    fc.request({ k: "tune", edit: { path: "debug.enemiesEnabled", value: false } });
    const layout = fc.world.level.dungeon;
    check(layout.def.spec.seed === floorSeed(777, 1) && layout.def.spec.pieces === 16, "the ClientSession builds the floor its room sent", JSON.stringify(layout.def.spec));
    const entrance = layout.pieces[layout.def.entrance];
    const hops = (id: number) => walkRoute(layout, layout.def.entrance, id).length;
    const target = layout.pieces.filter((p) => p.y !== entrance.y && p.kind !== "stair").sort((p, q) => hops(p.id) - hops(q.id))[0];
    const route = walkRoute(layout, layout.def.entrance, target.id);
    let fLast = performance.now();
    let wp = 0;
    const fT = performance.now();
    while (wp < route.length && performance.now() - fT < 40000) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - fLast) / 1000);
      fLast = now;
      const me = fc.hero()?.curr;
      let mx = 0;
      let mz = 0;
      if (me) {
        const dx = route[wp].x - me.x;
        const dz = route[wp].z - me.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8) wp++;
        else {
          mx = dx / d;
          mz = dz / d;
        }
      }
      fc.advance(command({ moveX: mx, moveZ: mz, aimX: mx, aimZ: mx || mz ? mz : -1 }), dt);
      await sleep(Math.max(1, TICK_MS / 2));
    }
    const settleAt = performance.now();
    while (performance.now() - settleAt < 700) {
      const now = performance.now();
      fc.advance(command(), Math.min(0.1, (now - fLast) / 1000));
      fLast = now;
      await sleep(Math.max(1, TICK_MS / 2));
    }
    const fHero = fc.hero()!.curr;
    check(wp === route.length && insidePiece(target, fHero.x, fHero.z), "the predicted hero walks the floor to a room at another height", `${target.kind} at ${target.y.toFixed(1)} m from ${entrance.y.toFixed(1)} m, waypoint ${wp}/${route.length}`);
    check(Math.abs(fHero.y - target.y) < 0.05, "and stands on its floor", `y ${fHero.y.toFixed(2)}`);
    check(fc.stats.snaps === 0, "the ClientSession never snapped on the floor", `${fc.stats.snapshots} snapshots, ${fc.stats.corrections} corrections, largest ${fc.stats.maxCorrection.toFixed(3)} m`);
    fc.request({ k: "tune", edit: { path: "debug.enemiesEnabled", value: true } });

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

/**
 * Walk a pair of bots from a floor's entrance to its exit along the doorways. A fight room shuts once
 * both are inside it; the dev cheats clear it (killing everything until the doors open) before they
 * walk on.
 */
async function walkFloor(a: Bot, b: Bot, layout: FloorLayout): Promise<number> {
  const route = walkRoute(layout, layout.def.entrance, layout.def.exit);
  let fights = 0;
  for (const pt of route) {
    await Promise.all([a.walkTo(pt.x, pt.z, 1.2, 30000, false), b.walkTo(pt.x, pt.z, 1.2, 30000, false)]);
    if (a.state.run.phase !== "intro" && a.state.run.phase !== "wave") continue;
    fights++;
    await a.until(() => a.state.run.phase === "wave", 5000, "the room's fight");
    const phase = (): string => a.state.run.phase;
    for (let k = 0; k < 20 && phase() !== "ante"; k++) {
      a.send({ k: "cheat", cheat: "killAll" });
      await Promise.all([a.drive(15), b.drive(15)]);
    }
    if (phase() !== "ante") throw new Error(`a fight room never opened: ${a.state.run.phase}`);
  }
  check(a.state.floor!.cleared.length === fights, "walking the floor, every room that shut opened again", `${fights} on the way`);
  const exit = layout.pieces[layout.def.exit];
  check(insidePiece(exit, a.me()!.x, a.me()!.z) && insidePiece(exit, b.me()!.x, b.me()!.z), `both reach the far end (${exit.kind}), ${route.length} waypoints`);
  return fights;
}

void main();
