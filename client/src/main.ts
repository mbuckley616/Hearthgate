import {
  ABILITIES,
  DOWNS,
  ENEMY_KINDS,
  SWORD_SLOTS,
  abilityInSlot,
  type AbilityId,
  type EnemyKind,
  HIT_FEEDBACK,
  PLAYER,
  POSTURE,
  isPlayerStaggered,
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
 * Phase 1: a party in one room with walls and a handful of goblins.
 *
 * Loop shape:
 *  - a fixed 20 Hz tick samples input, predicts our own player, sends the frame;
 *  - requestAnimationFrame draws: our predicted player with error smoothing,
 *    everyone else interpolated 100 ms behind the server, the enemies likewise.
 */

const params = new URLSearchParams(location.search);
// A hosted client bakes its server in at build time (VITE_SERVER_URL); a dev client talks to the same host on 2567.
const defaultEndpoint: string =
  import.meta.env.VITE_SERVER_URL || `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
const endpoint = params.get("server") ?? defaultEndpoint;
const name = params.get("name") ?? pickName();
// ?level=field joins (or creates) a room on the Phase 0 open field; tests use it.
const levelParam = params.get("level") ?? undefined;

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
  if (e.kind === "playerHit" || e.kind === "abilityHit") {
    const mine = e.attackerId === net.sessionId;
    sound.hitDealt(mine ? 1 : HIT_FEEDBACK.othersVolume);
    if (mine) {
      const gob = enemyPose(e.enemyId);
      view.nudge(gob.x - me.x, gob.z - me.z, HIT_FEEDBACK.dealtNudgeM, HIT_FEEDBACK.dealtNudgeMs);
    }
  } else if (e.kind === "enemyHit") {
    const mine = e.targetId === net.sessionId;
    sound.hitTaken(mine ? 1 : HIT_FEEDBACK.othersVolume);
    if (mine) {
      const gob = enemyPose(e.enemyId);
      view.nudge(me.x - gob.x, me.z - gob.z, HIT_FEEDBACK.takenNudgeM, HIT_FEEDBACK.takenNudgeMs);
    }
  }
}

/** Where an enemy is drawn, or a spot just ahead of us if we have not seen it yet. */
function enemyPose(id: string): { x: number; z: number } {
  const v = net.enemies.get(id);
  const pose = v ? net.remotePose(v) : null;
  return pose ?? { x: net.me.x + Math.sin(net.me.facing), z: net.me.z + Math.cos(net.me.facing) };
}

net
  .connect(endpoint, name, levelParam)
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
  view.setLevel(net.level);

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
    guarding: me.guarding,
    staggered: isPlayerStaggered(me, now),
    downed: isDowned(me),
    pickup: isDowned(me) ? clamp01(me.pickupMs / DOWNS.pickupMs) : 0,
    dead: isDead(me)
  });
  view.follow(myPose.x, myPose.z, dt);

  // Everyone else.
  const live = new Set<string>([net.sessionId]);
  const drawT = serverNow - 100;
  for (const r of net.remotes.values()) {
    live.add(r.id);
    view.ensurePlayer(r.id, r.name, r.color);
    const pose = net.remotePose(r);
    if (!pose) continue;
    view.updatePlayer(r.id, pose, {
      hp: r.hp,
      attacking: drawT < r.attackUntil,
      swingActive: r.attackUntil > 0 && drawT >= r.attackUntil - (PLAYER.attackDurationMs - PLAYER.attackWindupMs) && drawT < r.attackUntil - 150,
      cleaveActive: cleaveFlash(r.abilitySlot, r.abilityUntil, drawT),
      dodging: drawT < r.dodgeUntil,
      guarding: r.guarding,
      staggered: drawT < r.staggerUntil,
      downed: r.hp <= 0 && r.downedUntil > 0,
      pickup: r.downedUntil > 0 ? clamp01(r.pickupMs / DOWNS.pickupMs) : 0,
      dead: r.hp <= 0 && r.downedUntil === 0
    });
  }
  for (const id of view.playerIds()) if (!live.has(id)) view.removePlayer(id);

  // The enemies.
  const liveEnemies = new Set<string>();
  for (const e of net.enemies.values()) {
    liveEnemies.add(e.id);
    view.ensureEnemy(e.id, e.kind);
    const ePose = net.remotePose(e);
    if (!ePose) continue;
    const def = ENEMY_KINDS[e.kind];
    const windup = e.phase === "windup" ? clamp01(1 - (e.phaseUntil - drawT) / def.windupMs) : 0;
    const aim = e.phase === "aim" && def.charge ? clamp01(1 - (e.phaseUntil - drawT) / def.charge.aimMs) : 0;
    view.updateEnemy(e.id, ePose, { hp: e.hp, maxHp: e.maxHp, phase: e.phase, windup, aim, hitFlash: drawT < e.hitFlashUntil, guardUp: e.guardUp, rallied: e.rallied });
  }
  for (const id of view.enemyIds()) if (!liveEnemies.has(id)) view.removeEnemy(id);

  view.render();

  // HUD: the nearest living enemy's bar, and how many are left.
  const t = performance.now();
  while (recentEvents.length && recentEvents[0].until < t) recentEvents.shift();
  const nearest = net.nearestEnemy(myPose.x, myPose.z);
  const left = net.enemiesAlive();
  const total = net.enemies.size;
  hud.update({
    myName: net.myName || name,
    myHp: me.hp,
    myMaxHp: PLAYER.hp,
    dead: me.hp <= 0,
    banner: downBanner(me, now),
    enemyLabel: nearest
      ? `${kindName(nearest.view.kind)}, ${left} of ${total} left${drawT < nearest.view.postureBrokenUntil ? ", off balance" : nearest.view.guardUp ? ", shield up" : nearest.view.rallied ? ", rallied" : ""}`
      : total > 0
        ? "Room clear"
        : "No enemies",
    enemyHp: nearest?.view.hp ?? 0,
    enemyMaxHp: nearest?.view.maxHp ?? 0,
    enemiesLeft: left,
    enemiesTotal: total,
    players: 1 + net.remotes.size,
    rtt: net.rttMs,
    pending: net.pending.length,
    corrections: net.corrections,
    draughts: me.draughts,
    posture: me.posture,
    postureMax: POSTURE.player,
    guarding: me.guarding,
    staggered: isPlayerStaggered(me, now),
    reviveTarget: reviveTarget(myPose),
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
    /** The nearest living enemy (what the HUD shows), kept for the older tests. */
    enemy: nearest ? { id: nearest.view.id, hp: nearest.view.hp, phase: nearest.view.phase } : { id: "", hp: 0, phase: "dead" },
    enemies: Object.fromEntries([...net.enemies.values()].map((e) => [e.id, { kind: e.kind, hp: e.hp, phase: e.phase, pose: net.remotePose(e) }])),
    enemiesLeft: left,
    level: net.level.id,
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
      return `${who} cleaved ${enemyName(e.enemyId)} for ${e.damage}: staggered${e.interrupted ? ", swing broken" : ""}`;
    }
    case "playerHit": {
      const what = e.shielded ? `${enemyName(e.enemyId)}'s shield` : enemyName(e.enemyId);
      return e.attackerId === net.sessionId ? `You hit ${what} for ${e.damage}` : `${nameOf(e.attackerId)} hit ${what} for ${e.damage}`;
    }
    case "enemyKilled":
      return e.killerId === net.sessionId ? `You felled ${enemyName(e.enemyId)}` : `${nameOf(e.killerId)} felled ${enemyName(e.enemyId)}`;
    case "enemyHit": {
      const verb = e.blocked ? "hit your guard" : "hit you";
      return e.targetId === net.sessionId ? `${capital(enemyName(e.enemyId))} ${verb} for ${e.damage}` : `${capital(enemyName(e.enemyId))} hit ${nameOf(e.targetId)}`;
    }
    case "playerParried": {
      const who = e.playerId === net.sessionId ? "You" : nameOf(e.playerId);
      return `${who} parried ${enemyName(e.enemyId)}: ${e.postureBroken ? "its guard is broken" : "staggered"}`;
    }
    case "playerStaggered":
      return e.playerId === net.sessionId ? "You are knocked off balance" : `${nameOf(e.playerId)} is off balance`;
    case "playerKnocked":
      return e.playerId === net.sessionId ? `${capital(enemyName(e.enemyId))} ran you down` : `${capital(enemyName(e.enemyId))} ran down ${nameOf(e.playerId)}`;
    case "chargeWall":
      return `${capital(enemyName(e.enemyId))} hit the wall: stunned`;
    case "postureBroken":
      return `${capital(enemyName(e.enemyId))} is off balance: hit it now`;
    case "roomCleared":
      return "Room clear";
    case "roomReset":
      return "The goblins are back";
    case "playerDowned":
      return e.playerId === net.sessionId ? "You went down" : `${nameOf(e.playerId)} is down: get next to them`;
    case "playerPickedUp":
      if (e.byId === "") return e.playerId === net.sessionId ? "Room clear: back on your feet" : `${nameOf(e.playerId)} is back up`;
      if (e.byId === net.sessionId) return `You picked up ${nameOf(e.playerId)}`;
      return e.playerId === net.sessionId ? `${nameOf(e.byId)} picked you up` : `${nameOf(e.byId)} picked up ${nameOf(e.playerId)}`;
    case "playerRevived": {
      const by = e.byId === net.sessionId ? "You" : nameOf(e.byId);
      if (e.playerId === net.sessionId) return `${by} brought you back with a draught`;
      return `${by} brought ${nameOf(e.playerId)} back with a draught`;
    }
    case "playerDied":
      return e.playerId === net.sessionId ? "You bled out" : `${nameOf(e.playerId)} bled out`;
    case "squadWiped":
      return "The squad is down. Regrouping";
    case "playerRespawned":
      return e.playerId === net.sessionId ? "Back on your feet" : `${nameOf(e.playerId)} is back`;
  }
}

const ABILITY_NAMES: Record<AbilityId, string> = { cleave: "Cleave" };
const KIND_NAMES: Record<EnemyKind, string> = { goblin: "Goblin", shieldbearer: "Shieldbearer", charger: "Charger", packLeader: "Pack Leader" };

function kindName(kind: EnemyKind): string {
  return KIND_NAMES[kind] ?? kind;
}

/** "the goblin" (or "a goblin" when the id is unknown): lower case for the middle of a sentence. */
function enemyName(id: string): string {
  const v = net.enemies.get(id);
  return v ? `the ${kindName(v.kind).toLowerCase()}` : "a goblin";
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
  return "Out of this fight. A friend's draught, or the room clearing, brings you back";
}

/**
 * The dead teammate a draught would reach from where we are drawn, for the HUD prompt only;
 * the server picks the body. Ones on a respawn timer are not shown, as the server skips them.
 */
function reviveTarget(pose: { x: number; z: number }): string {
  let best = "";
  let bestD = Infinity;
  for (const r of net.remotes.values()) {
    if (r.hp > 0 || r.downedUntil > 0 || r.respawnAt > 0) continue;
    const p = net.remotePose(r);
    if (!p) continue;
    const d = Math.hypot(p.x - pose.x, p.z - pose.z);
    if (d <= DOWNS.draughtRange && d < bestD) {
      bestD = d;
      best = r.name;
    }
  }
  return best;
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
