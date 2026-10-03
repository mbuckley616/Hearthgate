import { GOBLIN, PLAYER, TICK_MS, type SimEvent } from "@hearthgate/shared";
import { Input } from "./input";
import { Net } from "./net";
import { View } from "./render";
import { Hud } from "./hud";

/**
 * Phase 0: two (or more) browsers in one room, one goblin, one attack.
 *
 * Loop shape:
 *  - a fixed 20 Hz tick samples input, predicts our own player, sends the frame;
 *  - requestAnimationFrame draws: our predicted player with error smoothing,
 *    everyone else interpolated 100 ms behind the server, the goblin likewise.
 */

const params = new URLSearchParams(location.search);
// A hosted client bakes its server in at build time (VITE_SERVER_URL); a dev client talks to the same host on 2567.
const defaultEndpoint: string =
  import.meta.env.VITE_SERVER_URL || `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
const endpoint = params.get("server") ?? defaultEndpoint;
const name = params.get("name") ?? pickName();

const app = document.getElementById("app")!;
const view = new View(app);
const hud = new Hud(document.getElementById("hud")!);
const input = new Input();
const net = new Net();

hud.setStatus(`Connecting to ${endpoint}`);

const recentEvents: { text: string; until: number }[] = [];
net.onEvents((events: SimEvent[]) => {
  for (const e of events) {
    const text = describeEvent(e);
    if (text) recentEvents.push({ text, until: performance.now() + 2500 });
  }
});

net
  .connect(endpoint, name)
  .then(() => {
    hud.setStatus("");
    startLoops();
  })
  .catch((err) => {
    console.error(err);
    hud.setStatus(`Could not connect to ${endpoint}. Is the server running? (npm run dev:server)`);
  });

function startLoops() {
  // Fixed-rate input tick. setInterval drifts slightly but the server re-times inputs per tick anyway.
  window.setInterval(() => {
    net.tick(input.sample());
  }, TICK_MS);

  let last = performance.now();
  const frame = (t: number) => {
    const dt = Math.min(50, t - last);
    last = t;
    draw(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function draw(dt: number) {
  const now = net.predictedTime;
  const serverNow = net.serverNow();

  // Me.
  view.ensurePlayer(net.sessionId, net.myName || name, net.myColor);
  const myPose = net.myPose(dt);
  const me = net.me;
  view.updatePlayer(net.sessionId, myPose, {
    hp: me.hp,
    attacking: now < me.attackUntil,
    swingActive: me.attackUntil > 0 && now >= me.attackUntil - (PLAYER.attackDurationMs - PLAYER.attackWindupMs) && now < me.attackUntil - 150,
    dodging: now < me.dodgeUntil,
    dead: me.hp <= 0
  });
  view.follow(myPose.x, myPose.z, dt);

  // Everyone else.
  const live = new Set<string>([net.sessionId]);
  for (const r of net.remotes.values()) {
    live.add(r.id);
    view.ensurePlayer(r.id, r.name, r.color);
    const pose = net.remotePose(r);
    if (!pose) continue;
    const drawT = serverNow - 100;
    view.updatePlayer(r.id, pose, {
      hp: r.hp,
      attacking: drawT < r.attackUntil,
      swingActive: r.attackUntil > 0 && drawT >= r.attackUntil - (PLAYER.attackDurationMs - PLAYER.attackWindupMs) && drawT < r.attackUntil - 150,
      dodging: drawT < r.dodgeUntil,
      dead: r.hp <= 0
    });
  }
  for (const id of view.playerIds()) if (!live.has(id)) view.removePlayer(id);

  // The goblin.
  const e = net.enemy;
  const ePose = net.remotePose(e);
  if (ePose) {
    const drawT = serverNow - 100;
    const windup = e.phase === "windup" ? clamp01(1 - (e.phaseUntil - drawT) / GOBLIN.windupMs) : 0;
    view.updateEnemy(ePose, { hp: e.hp, phase: e.phase, windup, hitFlash: drawT < e.hitFlashUntil });
  }

  view.render();

  // HUD.
  const t = performance.now();
  while (recentEvents.length && recentEvents[0].until < t) recentEvents.shift();
  hud.update({
    myName: net.myName || name,
    myHp: me.hp,
    myMaxHp: PLAYER.hp,
    dead: me.hp <= 0,
    respawnIn: me.hp <= 0 && me.respawnAt > 0 ? Math.max(0, me.respawnAt - now) : 0,
    enemyHp: e.hp,
    enemyMaxHp: GOBLIN.hp,
    enemyPhase: e.phase,
    players: 1 + net.remotes.size,
    rtt: net.rttMs,
    pending: net.pending.length,
    corrections: net.corrections,
    roomId: net.room?.roomId ?? "",
    events: recentEvents.map((x) => x.text)
  });

  // Debug handle for Playwright and the browser console.
  (window as any).__hg = {
    sessionId: net.sessionId,
    me: { x: me.x, z: me.z, hp: me.hp, lastSeq: me.lastSeq },
    players: Object.fromEntries([...net.remotes.values()].map((r) => [r.id, { name: r.name, hp: r.hp, pose: net.remotePose(r) }])),
    enemy: { hp: e.hp, phase: e.phase },
    rtt: net.rttMs,
    tick: net.lastServerTick
  };
}

function describeEvent(e: SimEvent): string {
  switch (e.kind) {
    case "playerHit":
      return e.attackerId === net.sessionId ? `You hit the goblin for ${e.damage}` : `${nameOf(e.attackerId)} hit the goblin for ${e.damage}`;
    case "enemyKilled":
      return e.killerId === net.sessionId ? "You felled the goblin" : `${nameOf(e.killerId)} felled the goblin`;
    case "enemyHit":
      return e.targetId === net.sessionId ? `The goblin hit you for ${e.damage}` : `The goblin hit ${nameOf(e.targetId)}`;
    case "playerDied":
      return e.playerId === net.sessionId ? "You went down" : `${nameOf(e.playerId)} went down`;
    case "playerRespawned":
      return e.playerId === net.sessionId ? "Back on your feet" : `${nameOf(e.playerId)} is back`;
  }
}

function nameOf(id: string): string {
  return net.remotes.get(id)?.name ?? "Someone";
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function pickName(): string {
  const names = ["Bram", "Orla", "Tadhg", "Niamh", "Fenn", "Maeve", "Cormac", "Sibby"];
  return names[Math.floor(Math.random() * names.length)];
}
