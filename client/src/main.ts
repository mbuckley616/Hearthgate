import {
  ABILITIES,
  DOWNS,
  SWORD_SLOTS,
  abilityInSlot,
  type AbilityId,
  GOBLIN,
  HIT_FEEDBACK,
  PLAYER,
  TICK_MS,
  isDead,
  isDowned,
  type PlayerSim,
  type SimEvent
} from "@hearthgate/shared";
import { Input } from "./input";
import { Net } from "./net";
import { View } from "./render";
import { Hud } from "./hud";
import { Sound } from "./sound";

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
const sound = new Sound();

hud.setStatus(`Connecting to ${endpoint}`);

const recentEvents: { text: string; until: number }[] = [];
net.onEvents((events: SimEvent[]) => {
  for (const e of events) {
    const text = describeEvent(e);
    if (text) recentEvents.push({ text, until: performance.now() + 2500 });
    hitFeedback(e);
  }
});

/**
 * Presentation only: the server already decided the hit. Your own hits get the camera
 * nudge and full volume; a friend's are quieter so you can still hear the fight.
 */
/** Hits you landed or took; the e2e test checks each one nudged the camera. */
let hitCount = 0;
function hitFeedback(e: SimEvent) {
  if (((e.kind === "playerHit" || e.kind === "abilityHit") && e.attackerId === net.sessionId) || (e.kind === "enemyHit" && e.targetId === net.sessionId)) hitCount++;
  const me = net.me;
  const gob = net.remotePose(net.enemy) ?? { x: me.x, z: me.z + 1 };
  if (e.kind === "playerHit" || e.kind === "abilityHit") {
    const mine = e.attackerId === net.sessionId;
    sound.hitDealt(mine ? 1 : HIT_FEEDBACK.othersVolume);
    if (mine) view.nudge(gob.x - me.x, gob.z - me.z, HIT_FEEDBACK.dealtNudgeM, HIT_FEEDBACK.dealtNudgeMs);
  } else if (e.kind === "enemyHit") {
    const mine = e.targetId === net.sessionId;
    sound.hitTaken(mine ? 1 : HIT_FEEDBACK.othersVolume);
    if (mine) view.nudge(me.x - gob.x, me.z - gob.z, HIT_FEEDBACK.takenNudgeM, HIT_FEEDBACK.takenNudgeMs);
  }
}

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
    cleaveActive: cleaveFlash(me.abilitySlot, me.abilityUntil, now),
    dodging: now < me.dodgeUntil,
    downed: isDowned(me),
    pickup: isDowned(me) ? clamp01(me.pickupMs / DOWNS.pickupMs) : 0,
    dead: isDead(me)
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
      cleaveActive: cleaveFlash(r.abilitySlot, r.abilityUntil, drawT),
      dodging: drawT < r.dodgeUntil,
      downed: r.hp <= 0 && r.downedUntil > 0,
      pickup: r.downedUntil > 0 ? clamp01(r.pickupMs / DOWNS.pickupMs) : 0,
      dead: r.hp <= 0 && r.downedUntil === 0
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
    banner: downBanner(me, now),
    enemyHp: e.hp,
    enemyMaxHp: GOBLIN.hp,
    enemyPhase: e.phase,
    players: 1 + net.remotes.size,
    rtt: net.rttMs,
    pending: net.pending.length,
    corrections: net.corrections,
    roomId: net.room?.roomId ?? "",
    events: recentEvents.map((x) => x.text),
    slots: SWORD_SLOTS.map((id, i) => ({
      name: id ? ABILITY_NAMES[id] : "",
      readyIn: Math.max(0, (me.readyAt[i] ?? 0) - now) / 1000
    }))
  });

  // Debug handle for Playwright and the browser console.
  (window as any).__hg = {
    sessionId: net.sessionId,
    me: { x: me.x, z: me.z, hp: me.hp, lastSeq: me.lastSeq },
    players: Object.fromEntries([...net.remotes.values()].map((r) => [r.id, { name: r.name, hp: r.hp, pose: net.remotePose(r) }])),
    enemy: { hp: e.hp, phase: e.phase },
    rtt: net.rttMs,
    minRtt: net.minRttMs,
    clockOffset: net.clockOffset,
    snaps: net.snaps,
    tick: net.lastServerTick,
    nudges: view.nudges,
    myHits: hitCount
  };
}

function describeEvent(e: SimEvent): string {
  switch (e.kind) {
    case "abilityHit": {
      const who = e.attackerId === net.sessionId ? "You" : nameOf(e.attackerId);
      return `${who} cleaved the goblin for ${e.damage}: staggered${e.interrupted ? ", swing broken" : ""}`;
    }
    case "playerHit":
      return e.attackerId === net.sessionId ? `You hit the goblin for ${e.damage}` : `${nameOf(e.attackerId)} hit the goblin for ${e.damage}`;
    case "enemyKilled":
      return e.killerId === net.sessionId ? "You felled the goblin" : `${nameOf(e.killerId)} felled the goblin`;
    case "enemyHit":
      return e.targetId === net.sessionId ? `The goblin hit you for ${e.damage}` : `The goblin hit ${nameOf(e.targetId)}`;
    case "playerDowned":
      return e.playerId === net.sessionId ? "You went down" : `${nameOf(e.playerId)} is down: get next to them`;
    case "playerPickedUp":
      if (e.byId === "") return e.playerId === net.sessionId ? "Room clear: back on your feet" : `${nameOf(e.playerId)} is back up`;
      if (e.byId === net.sessionId) return `You picked up ${nameOf(e.playerId)}`;
      return e.playerId === net.sessionId ? `${nameOf(e.byId)} picked you up` : `${nameOf(e.byId)} picked up ${nameOf(e.playerId)}`;
    case "playerDied":
      return e.playerId === net.sessionId ? "You bled out" : `${nameOf(e.playerId)} bled out`;
    case "squadWiped":
      return "The squad is down. Regrouping";
    case "playerRespawned":
      return e.playerId === net.sessionId ? "Back on your feet" : `${nameOf(e.playerId)} is back`;
  }
}

const ABILITY_NAMES: Record<AbilityId, string> = { cleave: "Cleave" };

/** Cleave's arc shows from the moment its hit resolves until shortly after. */
function cleaveFlash(slot: number, until: number, t: number): boolean {
  if (abilityInSlot(slot) !== "cleave" || until === 0) return false;
  const c = ABILITIES.cleave;
  const hitAt = until - c.durationMs + c.windupMs;
  return t >= hitAt && t < hitAt + 200;
}

function downBanner(me: PlayerSim, now: number): string {
  if (isDowned(me)) {
    if (me.pickupMs > 0) return `Being picked up ${Math.round((100 * me.pickupMs) / DOWNS.pickupMs)}%`;
    return `Down. Bleeding out in ${Math.ceil(Math.max(0, me.downedUntil - now) / 1000)}. Crawl to a friend`;
  }
  if (!isDead(me)) return "";
  if (me.respawnAt > 0) return `Back in ${Math.ceil(Math.max(0, me.respawnAt - now) / 1000)}`;
  return "Out of this fight. Back when the goblin falls";
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
