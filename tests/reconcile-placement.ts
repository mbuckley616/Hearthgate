/**
 * Client reconciliation check that needs no server: feeds the real `Net` class fake
 * patches and checks what it counts as corrections and snaps.
 *   1. the first patch, which places us at our spawn, is not a snap;
 *   2. a respawn (dead to standing at the spawn) is not a snap or a correction;
 *   3. a real prediction error over SNAP_DISTANCE still is;
 *   4. a Charger's throw is replayed as a slide from the server's knock state: the patch that
 *      brings it is a smoothed correction (the client could not know), never a snap, and the
 *      next patch agrees with the replay.
 * The critic found respawns and wipes inflating the HUD counts and `__hg.snaps` (2026-10-04).
 *
 * Run: part of npm run test:net
 */
import { KNOCKBACK, PLAYER, TICK_MS } from "@hearthgate/shared";
import { Net, SNAP_DISTANCE } from "../client/src/net.ts";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const ID = "me";
let tick = 100;

function patch(net: Net, p: { x: number; z: number; hp: number; [field: string]: number }) {
  tick++;
  const player = {
    name: "Tester",
    color: "#ffffff",
    facing: 0,
    lastSeq: 0,
    dodgeUntil: 0,
    dodgeCooldownUntil: 0,
    dodgeDx: 0,
    dodgeDz: 0,
    attackUntil: 0,
    attackHitAt: 0,
    abilityUntil: 0,
    abilityHitAt: 0,
    abilitySlot: 0,
    readyAt: [0, 0, 0],
    pickupMs: 0,
    pickupBy: "",
    downedUntil: 0,
    respawnAt: 0,
    draughts: 1,
    ...p
  };
  const state = {
    tick,
    players: new Map([[ID, player]]),
    levelId: "field",
    enemies: new Map([["e1", { id: "e1", kind: "goblin", hp: 60, maxHp: 60, phase: "idle", phaseUntil: 0, targetId: "", hitFlashUntil: 0, x: 0, z: 6, facing: 0 }]])
  };
  (net as any).onState(state);
}

const net = new Net();
net.sessionId = ID;

// 1. Joining: the client starts at the origin, the server puts us at a spawn 4 m away.
patch(net, { x: 4, z: -3, hp: PLAYER.hp });
if (net.snaps !== 0 || net.corrections !== 0) fail(`joining counted ${net.snaps} snaps and ${net.corrections} corrections`);

// 2. Downed where we fell, bled out (dead), then respawned at the spawn 10 m away.
patch(net, { x: 12, z: 4, hp: PLAYER.hp });
const before = { snaps: net.snaps, corrections: net.corrections };
patch(net, { x: 12, z: 4, hp: 0, downedUntil: tick * TICK_MS + 30_000 });
patch(net, { x: 12, z: 4, hp: 0, respawnAt: tick * TICK_MS + 3000 });
patch(net, { x: 4, z: -3, hp: PLAYER.hp });
if (net.snaps !== before.snaps || net.corrections !== before.corrections) {
  fail(`a respawn counted ${net.snaps - before.snaps} snaps and ${net.corrections - before.corrections} corrections`);
}
if (net.visualErrX !== 0 || net.visualErrZ !== 0) fail("a respawn left a visual offset to decay");
if (net.me.x !== 4 || net.me.z !== -3) fail(`after the respawn we are at ${net.me.x}, ${net.me.z}, not the spawn`);

// 3. A real error while standing still snaps and counts.
patch(net, { x: 4 + SNAP_DISTANCE + 1, z: -3, hp: PLAYER.hp });
if (net.snaps !== before.snaps + 1 || net.corrections !== before.corrections + 1) {
  fail(`a ${SNAP_DISTANCE + 1} m error while standing counted ${net.snaps - before.snaps} snaps`);
}

// 4. Thrown north at tick T while two of our inputs are still unconfirmed.
patch(net, { x: 0, z: 0, hp: PLAYER.hp, lastSeq: 10 });
const beforeThrow = { snaps: net.snaps, corrections: net.corrections };
net.pending = [11, 12].map((seq) => ({ seq, dx: 0, dy: 0, attack: false, dodge: false }));
const thrownAt = (tick + 1) * TICK_MS;
const knock = { knockUntil: thrownAt + KNOCKBACK.ms, knockDx: 0, knockDz: KNOCKBACK.speed };
patch(net, { x: 0, z: 0, hp: PLAYER.hp, lastSeq: 10, ...knock });
const slid = (2 * KNOCKBACK.speed * TICK_MS) / 1000;
if (Math.abs(net.me.z - slid) > 1e-9) fail(`replaying two frames of a throw put us at z = ${net.me.z}, not ${slid}`);
if (net.snaps !== beforeThrow.snaps) fail("a throw counted as a snap");
const afterThrow = net.corrections;
patch(net, { x: 0, z: slid, hp: PLAYER.hp, lastSeq: 12, ...knock });
if (net.corrections !== afterThrow || net.snaps !== beforeThrow.snaps) fail("the patch after a throw disagreed with the replay");

console.log("ok: joining and a respawn are placements, not snaps; a real 3.5 m error still snaps; a throw replays as a slide");
