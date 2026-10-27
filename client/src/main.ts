import {
  ABILITIES,
  DOWNS,
  ENEMY_KINDS,
  WEAPON_CLASSES,
  abilityInSlot,
  slotsFor,
  weaponClassOf,
  gearName,
  inCone,
  lineClear,
  weaponFromPick,
  type WeaponGear,
  type AbilityId,
  type EnemyKind,
  HIT_FEEDBACK,
  EVENT_LOG,
  NPC,
  PLAYER,
  PORTAL,
  POSTURE,
  STAIRS,
  levelById,
  type Npc,
  isAirborne,
  isPlayerStaggered,
  jumpHeight,
  TICK_MS,
  createInputClock,
  dueInputTicks,
  nextInputAt,
  isDead,
  isDowned,
  type PlayerSim,
  type SimEvent,
  clearedBarText,
  expireLogLines,
  pushLogLine,
  type LogLine
} from "@hearthgate/shared";
import { Input } from "./input";
import { pickWeapon } from "./join";
import { loadModels } from "./models";
import { Net, type Pose } from "./net";
import { View } from "./render";
import { Hud } from "./hud";
import { Sound } from "./sound";
import { DebugPanel } from "./debug";

/**
 * Phase 1: the party starts in the village (the greybox town), takes the portal into the
 * Warrens, and the stairs bring it home; the server moves everyone between the two rooms.
 *
 * Loop shape:
 *  - a fixed 60 Hz tick samples input, predicts our own player, sends the frame;
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
// A scripted join (?name= or ?weapon=, as the tests and the lab use) skips the join screen;
// ?weapon=claymore&tier=5 picks for it, and without them it holds the starter sword.
const scriptedJoin = params.has("name") || params.has("weapon");

const app = document.getElementById("app")!;
const view = new View(app);
const input = new Input();
const net = new Net();
const sound = new Sound();
// The live tuning panel (backtick): edits go through the server so every client steps the same numbers.
const panel = new DebugPanel((edit) => net.sendTuning(edit));
net.onTuning(() => panel.refresh());
window.addEventListener("keydown", (e) => {
  if (e.code === "Backquote" && !e.repeat) panel.toggle();
});
// The villager prompt is a button too (a tap, for the touch layout to come): the same press as E.
const hud = new Hud(document.getElementById("hud")!, () => input.pressUse());

if (scriptedJoin) hud.setStatus(`Connecting to ${endpoint}`);

const recentEvents: LogLine[] = [];
/** What a villager last said to us, shown in the top-left panel for a while. */
let speech: { who: string; line: string; until: number } | null = null;
/** Between rooms: the status line stays up until the new room's first patch. */
let handingOff = false;
net.onEvents((events: SimEvent[]) => {
  for (const e of events) {
    const text = describeEvent(e);
    if (text) pushLogLine(recentEvents, text, performance.now(), EVENT_LOG);
    if (e.kind === "npcTalk" && e.playerId === net.sessionId) {
      const npc = net.level.npcs?.find((n) => n.id === e.npcId);
      if (npc) speech = { who: npc.name, line: npc.line, until: performance.now() + 8000 };
    }
    hitFeedback(e);
    if (e.kind === "combo") comboCallout(e);
  }
});
net.onHandoff((level, fallback) => {
  handingOff = true;
  recentEvents.length = 0;
  speech = null;
  hud.setStatus(
    fallback ? "The way closed: back to the village" : level === "village" ? "Up the stairs: back to the village" : `Through the portal: ${levelById(level).name}`
  );
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
/** The combo callout over the enemy and its chime; the server already applied the payoff. */
function comboCallout(e: Extract<SimEvent, { kind: "combo" }>) {
  const at = enemyPose(e.enemyId);
  const v = net.enemies.get(e.enemyId);
  const height = v ? ENEMY_KINDS[v.kind].radius * 2 + 1.9 : 2.4;
  view.showCallout(comboText(e), at.x, at.z, height);
  const mine = e.attackerId === net.sessionId;
  sound.combo(Math.max(2, e.contributors), mine ? 1 : HIT_FEEDBACK.othersVolume);
}

function comboText(e: Extract<SimEvent, { kind: "combo" }>): string {
  return e.mult > 1 ? `Combo x${e.mult}` : e.payoff === "crit" ? "Critical" : capital(e.payoff);
}

function enemyPose(id: string): { x: number; z: number } {
  const v = net.enemies.get(id);
  const pose = v ? net.remotePose(v) : null;
  return pose ?? { x: net.me.x + Math.sin(net.me.facing), z: net.me.z + Math.cos(net.me.facing) };
}

// The figures load once, before anyone is let in; a scripted join waits for them too.
const models = loadModels();
(scriptedJoin ? models.then(() => weaponFromPick(params.get("weapon") ?? "sword", params.get("tier") ?? 1)) : pickWeapon(models))
  .then((weapon) => {
    hud.setStatus(`Connecting to ${endpoint}`);
    return net.connect(endpoint, name, levelParam, weapon);
  })
  .then(() => {
    hud.setStatus("");
    startLoops();
  })
  .catch((err) => {
    console.error(err);
    hud.setStatus(`Could not connect to ${endpoint}. Is the server running? (npm run dev:server)`);
  });

function startLoops() {
  // Mouse look from here on, not on the join screen: a click on the game view takes the lock.
  input.attachMouse(view.renderer.domElement);
  // One input frame per tick of wall time, not per timer callback: a busy main thread runs the
  // timer late, and each frame it missed is sent when it does run (up to a cap), so a held key
  // covers the same ground at 10 fps as at 60. Self-scheduled to the next due tick, like the server's pump.
  const clock = createInputClock(performance.now());
  const pumpInput = () => {
    const n = dueInputTicks(clock, performance.now());
    for (let i = 0; i < n; i++) net.tick(input.sample(view.yaw));
    window.setTimeout(pumpInput, Math.max(1, nextInputAt(clock) - performance.now()));
  };
  window.setTimeout(pumpInput, TICK_MS);

  let last = performance.now();
  const frame = (t: number) => {
    const dt = Math.min(50, t - last);
    last = t;
    draw(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const lookNow = { x: 0, y: 0 };
const mouseNow = { x: 0, y: 0 };

function draw(dt: number) {
  const now = net.predictedTime;
  const remoteNow = net.remoteNow();
  view.setLevel(net.level);
  view.setStairs(net.stairsOpen, net.descendMs / STAIRS.holdMs);
  view.setPortal(net.portalMs / PORTAL.holdMs);
  if (handingOff && net.isPlaced) {
    handingOff = false;
    hud.setStatus("");
    // The new room put us somewhere else: a placement, so the camera starts there rather than
    // gliding across and reading the jump as travel to swing round behind.
    view.resetFollow();
  }

  // Me, once the room has placed us. Between a hand-off and the new room's first patch our
  // player still holds the old room's coordinates, then a fresh player's (0, 0): neither is
  // anywhere the server put us, so the figure is not drawn and the camera holds still.
  const placed = net.isPlaced;
  const myPose = net.myPose(dt);
  const me = net.me;
  if (placed) view.ensurePlayer(net.sessionId, net.myName || name, net.myColor, true);
  view.updatePlayer(net.sessionId, myPose, {
    hp: me.hp,
    attacking: now < me.attackUntil,
    weapon: me.weapon,
    swingActive: swingFlash(me.weapon, me.attackUntil, now),
    cleaveActive: cleaveFlash(me.weapon, me.abilitySlot, me.abilityUntil, now),
    dodging: now < me.dodgeUntil,
    jumping: isAirborne(me, now),
    lift: jumpHeight(me, now),
    guarding: me.guarding,
    staggered: isPlayerStaggered(me, now),
    downed: isDowned(me),
    pickup: isDowned(me) ? clamp01(me.pickupMs / DOWNS.pickupMs) : 0,
    dead: isDead(me)
  });

  // Everyone else.
  const live = new Set<string>(placed ? [net.sessionId] : []);
  const drawT = remoteNow;
  for (const r of net.remotes.values()) {
    live.add(r.id);
    view.ensurePlayer(r.id, r.name, r.color);
    const pose = net.remotePose(r);
    if (!pose) continue;
    view.updatePlayer(r.id, pose, {
      hp: r.hp,
      attacking: drawT < r.attackUntil,
      weapon: r.weapon,
      swingActive: swingFlash(r.weapon, r.attackUntil, drawT),
      cleaveActive: cleaveFlash(r.weapon, r.abilitySlot, r.abilityUntil, drawT),
      dodging: drawT < r.dodgeUntil,
      jumping: isAirborne(r, drawT),
      lift: jumpHeight(r, drawT),
      guarding: r.guarding,
      staggered: drawT < r.staggerUntil,
      downed: r.hp <= 0 && r.downedUntil > 0,
      pickup: r.downedUntil > 0 ? clamp01(r.pickupMs / DOWNS.pickupMs) : 0,
      dead: r.hp <= 0 && r.downedUntil === 0
    });
  }
  for (const id of view.playerIds()) if (!live.has(id)) view.removePlayer(id);

  // The bow's target: the lock if there is one, else whoever a shot would go to now.
  markBowTarget(myPose);

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

  // The camera: the player's own turn, else the bow's lock framed, else a swing in behind the travel.
  input.takeMouse(mouseNow);
  view.turnByMouse(mouseNow.x, mouseNow.y);
  if (placed) view.follow(myPose.x, myPose.z, dt, input.look(lookNow), lockedPose());

  view.render();

  // HUD: the nearest living enemy's bar, and how many are left.
  const t = performance.now();
  expireLogLines(recentEvents, t);
  if (speech && speech.until < t) speech = null;
  const village = net.level.portal !== undefined;
  const talkTo = villagerInReach(myPose);
  // A bow's lock takes the enemy panel; otherwise it shows the nearest.
  const lockedView = me.lockId ? net.enemies.get(me.lockId) : undefined;
  const nearest = lockedView && lockedView.phase !== "dead" ? { view: lockedView } : net.nearestEnemy(myPose.x, myPose.z);
  const isLocked = nearest !== null && nearest.view === lockedView;
  const left = net.enemiesAlive();
  const total = net.enemies.size;
  hud.update({
    myName: net.myName || name,
    weapon: gearName(me.weapon),
    myHp: me.hp,
    myMaxHp: PLAYER.hp,
    dead: me.hp <= 0,
    banner: downBanner(me, now),
    enemyLabel: village
      ? net.portalMs > 0
        ? `Portal: everyone on it (${Math.round((100 * net.portalMs) / PORTAL.holdMs)}%)`
        : `${net.level.name} village. Nothing here can hurt you`
      : nearest
      ? `${kindName(nearest.view.kind)}${isLocked ? " (locked)" : ""}, ${left} of ${total} left${drawT < nearest.view.postureBrokenUntil ? ", off balance" : nearest.view.guardUp ? ", shield up" : nearest.view.rallied ? ", rallied" : ""}`
      : net.stairsOpen
        ? `Stairs open: everyone onto them${net.descendMs > 0 ? ` (${Math.round((100 * net.descendMs) / STAIRS.holdMs)}%)` : ""}`
        : total > 0
          ? "Room clear"
          : "No enemies",
    enemyHp: nearest?.view.hp ?? 0,
    enemyMaxHp: nearest?.view.maxHp ?? 0,
    enemiesLeft: left,
    enemiesTotal: total,
    clearedText: clearedBarText(net.level),
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
    village,
    talkTo: talkTo?.name ?? "",
    speech: speech ? { who: speech.who, line: speech.line } : null,
    roomId: net.room?.roomId ?? "",
    events: recentEvents.map((x) => x.text),
    slots: slotsFor(me.weapon).map((id, i) => ({
      name: id ? ABILITY_NAMES[id] : "",
      readyIn: Math.max(0, (me.readyAt[i] ?? 0) - now) / 1000
    }))
  });

  // Debug handle for Playwright and the browser console.
  (window as any).__hg = {
    sessionId: net.sessionId,
    me: { x: me.x, z: me.z, hp: me.hp, lastSeq: me.lastSeq, weapon: { type: me.weapon.type, tier: me.weapon.tier }, lockId: me.lockId, jumpUntil: me.jumpUntil, attackUntil: me.attackUntil, guarding: me.guarding },
    players: Object.fromEntries([...net.remotes.values()].map((r) => [r.id, { name: r.name, hp: r.hp, pose: net.remotePose(r) }])),
    /** The nearest living enemy (what the HUD shows), kept for the older tests. */
    enemy: nearest ? { id: nearest.view.id, hp: nearest.view.hp, phase: nearest.view.phase } : { id: "", hp: 0, phase: "dead" },
    enemies: Object.fromEntries([...net.enemies.values()].map((e) => [e.id, { kind: e.kind, hp: e.hp, phase: e.phase, pose: net.remotePose(e) }])),
    enemiesLeft: left,
    level: net.level.id,
    room: net.roomName,
    handoffs: net.handoffs,
    handoffFallbacks: net.handoffFallbacks,
    portalMs: net.portalMs,
    talkTo: talkTo?.id ?? "",
    speech: speech ? speech.line : "",
    rtt: net.rttMs,
    minRtt: net.minRttMs,
    clockOffset: net.clockOffset,
    interpDelay: net.interpDelayMs,
    late: net.lateMs,
    snaps: net.snaps,
    tick: net.lastServerTick,
    ownDrawn: view.playerIds().includes(net.sessionId),
    nudges: view.nudges,
    camYaw: view.yaw,
    camPitch: view.pitchDeg,
    mouseLocked: input.mouseLocked,
    camDistance: view.camDistance,
    fadedWalls: view.fadedWalls(),
    figures: () => view.figureStats(),
    dressing: view.dressing?.counts ?? null,
    myHits: hitCount,
    callouts: view.calloutCount,
    lastCallout: view.lastCallout
  };
}

function describeEvent(e: SimEvent): string {
  switch (e.kind) {
    case "abilityHit": {
      const who = e.attackerId === net.sessionId ? "You" : nameOf(e.attackerId);
      if (e.ability === "execute") return `${who} ${e.attackerId === net.sessionId ? "execute" : "executes"} ${enemyName(e.enemyId)} for ${e.damage}`;
      if (e.ability === "arrowRain") return `${e.attackerId === net.sessionId ? "Your" : `${who}'s`} arrows hit ${enemyName(e.enemyId)} for ${e.damage}`;
      return `${who} cleaved ${enemyName(e.enemyId)} for ${e.damage}: staggered${e.interrupted ? ", swing broken" : ""}`;
    }
    case "arrowRain":
      view.showRain(e.x, e.z, ABILITIES.arrowRain.radius);
      return e.hits === 0 && e.playerId === net.sessionId ? "Your arrows found nothing" : "";
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
    case "combo": {
      const from = e.contributors > 1 ? ` from ${e.contributors} players` : "";
      const what = e.payoff === "crit" ? `${enemyName(e.enemyId)} knocked down` : `${e.payoff} on ${enemyName(e.enemyId)}`;
      return `${comboText(e)}${from}: ${what}`;
    }
    case "postureBroken":
      return `${capital(enemyName(e.enemyId))} is off balance: hit it now`;
    case "roomCleared":
      return e.room ? `${capital(e.room)}: clear` : "Room clear";
    case "floorCleared":
      return "Every room is clear: the stairs are open. Everyone onto them";
    case "stairsTaken":
      return "Everyone on the stairs: up and out";
    case "portalTaken":
      return "Everyone on the portal: through it";
    case "npcTalk":
      return e.playerId === net.sessionId ? "" : `${nameOf(e.playerId)} talks to ${net.level.npcs?.find((n) => n.id === e.npcId)?.name ?? "a villager"}`;
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

const ABILITY_NAMES: Record<AbilityId, string> = { cleave: "Cleave", execute: "Execute", arrowRain: "Arrow rain" };
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

/**
 * Where the archer's marker goes: on the locked enemy (solid), or for an unlocked bow on the
 * nearest living enemy in its cone with a clear line (faint), which is the server's auto pick
 * as near as the interpolated poses can tell. Presentation only; the server decides the shot.
 */
/** The bow's held lock, where it is drawn; null without one. The camera keeps it framed. */
function lockedPose(): Pose | null {
  const me = net.me;
  if (!me.lockId || weaponClassOf(me.weapon) !== "bow" || isDead(me) || isDowned(me)) return null;
  const v = net.enemies.get(me.lockId);
  return v && v.phase !== "dead" ? net.remotePose(v) : null;
}

function markBowTarget(from: Pose) {
  const me = net.me;
  if (weaponClassOf(me.weapon) !== "bow" || isDead(me) || isDowned(me)) return view.setTargetMarker(null, false);
  if (me.lockId) {
    const v = net.enemies.get(me.lockId);
    const pose = v && v.phase !== "dead" ? net.remotePose(v) : null;
    if (pose) return view.setTargetMarker(pose, true);
  }
  const bow = WEAPON_CLASSES.bow;
  let best: Pose | null = null;
  let bestD = Infinity;
  for (const v of net.enemies.values()) {
    if (v.phase === "dead") continue;
    const pose = net.remotePose(v);
    if (!pose || !inCone(from, pose, bow.range, bow.arc, ENEMY_KINDS[v.kind].radius) || !lineClear(from, pose, net.level)) continue;
    const d = Math.hypot(pose.x - from.x, pose.z - from.z);
    if (d < bestD) {
      bestD = d;
      best = pose;
    }
  }
  view.setTargetMarker(best, false);
}

/**
 * The villager a use press would talk to from where we are drawn, for the prompt only; the
 * server picks (talkToNpc) from where it has us, by the same range.
 */
function villagerInReach(pose: { x: number; z: number }): Npc | null {
  const me = net.me;
  if (!net.level.npcs || isDead(me) || isDowned(me)) return null;
  let best: Npc | null = null;
  let bestD = Infinity;
  for (const n of net.level.npcs) {
    const d = Math.hypot(n.x - pose.x, n.z - pose.z);
    if (d <= NPC.talkRange && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** The swing's arc shows from the moment its hit resolves until 150 ms before the swing ends. */
function swingFlash(weapon: WeaponGear, until: number, t: number): boolean {
  if (until === 0) return false;
  const c = WEAPON_CLASSES[weaponClassOf(weapon)];
  return t >= until - (c.durationMs - c.windupMs) && t < until - 150;
}

/** Cleave's arc shows from the moment its hit resolves until shortly after. */
function cleaveFlash(weapon: WeaponGear, slot: number, until: number, t: number): boolean {
  if (abilityInSlot(weapon, slot) !== "cleave" || until === 0) return false;
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
