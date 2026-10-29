import { FAMILY_ANIM, abilityTiming, enemyStats, stringAnim, stringMoveFor, tuning } from '../config/tuning';
import { groundHeight, type World } from '../level/arena';
import { resolveCircle, type Collider } from '../level/geometry';
import { abilityReady, freeAim, pickSoftTarget, startAbility, stepAbility, targetingRange } from './abilities';
import { damageEnemy, hitstopFor, isTargetable } from './combat';
import { chainLengthFor, emptyMods, levelFor } from './gear';
import { spawnArrow, spawnBolt, spawnBurst } from './projectiles';
import { armFlow, chainEnded, newFlow, onBeat, stepFlow } from './flow';
import { drinkPotion, smashArc } from './smash';
import type { PropInfo } from '../level/floor';
import { dodgeCancelMs, dodgeRechargeCut, emptyTalents, familyOf, heroHit, moveSpeedMult } from './talents';
import type { PlayerCommand, PlayerState, SimState } from './types';

const DEG = Math.PI / 180;

export function createPlayer(id: string, x: number, z: number, yaw: number): PlayerState {
  return {
    id,
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    grounded: true,
    mode: 'move',
    dodgeTime: 0,
    dodgeDirX: 0,
    dodgeDirZ: 0,
    dodgeDist: tuning.dodge.distance,
    dodgeBackstep: false,
    dodgeBuffered: false,
    guardTime: 0,
    guardRaisedAt: -1000,
    parryOpen: false,
    parrySeq: 0,
    blockSeq: 0,
    blockWasHeld: false,
    name: '',
    reviveProgress: 0,
    lagGrace: 0,
    talents: emptyTalents(),
    dodgeCharges: tuning.dodge.charges,
    dodgeRecharge: 0,
    dodgeCooldown: 0,
    invulnerable: false,
    style: 'sword',
    attackHit: 0,
    attackTime: 0,
    attackFired: false,
    attackQueued: false,
    attackSeq: 0,
    attackHitIds: [],
    hp: tuning.combat.heroMaxHp,
    maxHp: tuning.combat.heroMaxHp,
    xp: { sword: 0, bow: 0, staff: 0 },
    mods: emptyMods(),
    lastFinisherAt: -1,
    hitstop: 0,
    downTime: 0,
    invulnTime: 0,
    attackTarget: -1,
    attackLunge: 0,
    ability: 'charge',
    abilityTime: 0,
    abilityFired: false,
    abilityTicks: 0,
    abilitySeq: 0,
    abilityHitIds: [],
    cooldowns: { sword: [0, 0], bow: [0, 0], staff: [0, 0] },
    nextBoltCrit: false,
    queuedAbility: -1,
    queuedSwap: null,
    hurtTime: 0,
    kbx: 0,
    kbz: 0,
  };
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function turnToward(current: number, target: number, maxStep: number): number {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return wrapAngle(current + Math.sign(diff) * maxStep);
}

/** Fraction of dodge distance covered at normalised time u (0..1). */
function dodgeCurve(u: number): number {
  const k = 1 + tuning.dodge.easeOutPower;
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), k);
}

/** Fraction of a swing's lunge covered by time t into the swing (lunge happens during the active phase). */
function lungeCurve(t: number, windup: number, active: number): number {
  const u = Math.min(1, Math.max(0, (t - windup) / active));
  return 1 - (1 - u) * (1 - u);
}

/**
 * Light and heavy strings (C1): the move a string plays, if any. It takes the pose of the chain step
 * it borrows (attackHit), so the views and the projectiles follow without knowing about strings.
 */
function setStringMove(p: PlayerState, s: string, heavy: boolean): void {
  p.attackString = s;
  const move = stringMoveFor(p.style, s);
  if (move) {
    p.attackMove = move;
    p.attackHit = stringAnim(p.style, move);
  } else delete p.attackMove;
  if (heavy) p.attackCharge = 1;
  else delete p.attackCharge;
}

function startAttack(state: SimState, p: PlayerState, hitIndex: number, cmd: PlayerCommand, moveMag: number, prior = ''): void {
  p.mode = 'attack';
  p.attackHit = hitIndex;
  // A weapon family (C5) borrows a pose for each step of its own chain.
  const family = familyOf(p);
  if (family) {
    p.attackStep = hitIndex;
    p.attackHit = FAMILY_ANIM[family][Math.min(hitIndex, FAMILY_ANIM[family].length - 1)];
  } else if (p.attackStep !== undefined) delete p.attackStep;
  p.attackTime = 0;
  p.attackFired = false;
  p.attackQueued = false;
  p.attackSeq++;
  p.attackHitIds = [];
  if (p.flow) {
    // A fresh chain closes the last one; the press behind this swing was on the beat or it was not.
    if (!prior) chainEnded(p, p.attackString);
    p.flow.onBeat = p.flow.nextOnBeat;
    p.flow.nextOnBeat = false;
  }
  if (tuning.combo.heavies) {
    setStringMove(p, prior + 'L', false);
    delete p.attackHoldNext;
  }
  if (p.style === 'sword') {
    p.vx = 0;
    p.vz = 0;
  }
  // Strafe movement: attacks go where the camera looks. Otherwise the brief's fallback:
  // the move input, or camera forward when idle (soft targeting on enemies comes in M2).
  const useMove = !tuning.movement.faceCamera && moveMag > 0.01;
  const tx = useMove ? cmd.moveX : cmd.aimX;
  const tz = useMove ? cmd.moveZ : cmd.aimZ;
  if (Math.hypot(tx, tz) > 0.01) {
    p.yaw = turnToward(p.yaw, Math.atan2(tx, tz), tuning.combo.maxTurnDeg * DEG);
  }
  // Soft targeting: snap toward the best enemy near the aim (up to maxTurnDeg), remember it for the lunge and homing.
  // Free aim (D12) has none: the shot faces the aim exactly.
  const free = freeAim(p, cmd);
  if (free) p.yaw = Math.atan2(cmd.aimX, cmd.aimZ);
  const target = free ? null : pickSoftTarget(state, p, cmd, targetingRange(p));
  p.attackTarget = target ? target.id : -1;
  if (target) p.yaw = turnToward(p.yaw, Math.atan2(target.x - p.x, target.z - p.z), tuning.combo.maxTurnDeg * DEG);
  aimLunge(state, p);
}

/** Melee lunges stretch to reach a soft target, stopping short of it (brief). */
function aimLunge(state: SimState, p: PlayerState): void {
  const target = p.attackTarget >= 0 ? state.enemies.find((e) => e.id === p.attackTarget && isTargetable(e)) : undefined;
  const lunge = heroHit(p, p.attackHit).lunge;
  p.attackLunge = lunge;
  if (target && lunge > 0) {
    const tg = tuning.targeting;
    const gap = Math.hypot(target.x - p.x, target.z - p.z) - (tg.lungeStopShort + enemyStats(target.kind).radius + tuning.movement.radius);
    p.attackLunge = Math.max(0, Math.min(lunge + tg.lungeMagnetM, Math.max(lunge, gap)));
  }
}

function startDodge(state: SimState, p: PlayerState, cmd: PlayerCommand, moveMag: number): void {
  p.mode = 'dodge';
  p.dodgeTime = 0;
  p.attackQueued = false;
  if (p.flow) p.flow.dodged = false;
  // Dodge-refund perk: a dodge right after a finisher is free.
  const refund = p.mods.perks.includes('dodgeRefund') && p.lastFinisherAt >= 0 && state.time - p.lastFinisherAt <= tuning.gear.dodgeRefundWindowMs / 1000;
  if (refund) {
    p.lastFinisherAt = -1;
    state.events.push({ kind: 'perk', playerId: p.id, perk: 'dodgeRefund', x: p.x, z: p.z });
  } else {
    p.dodgeCharges--;
  }
  p.dodgeCooldown = tuning.dodge.minGapMs / 1000;
  p.invulnerable = false;
  // Dodge along move input; with no direction held, hop backward (Michael's call).
  p.dodgeBackstep = moveMag <= 0.01;
  p.dodgeDist = tuning.dodge.distance * (p.dodgeBackstep ? tuning.dodge.backstepDistanceFrac : 1);
  if (!p.dodgeBackstep) {
    p.dodgeDirX = cmd.moveX / moveMag;
    p.dodgeDirZ = cmd.moveZ / moveMag;
  } else {
    p.dodgeDirX = -Math.sin(p.yaw);
    p.dodgeDirZ = -Math.cos(p.yaw);
  }
  // With strafe movement the hero keeps facing the camera and rolls in the pressed direction.
  if (!tuning.movement.faceCamera && !p.dodgeBackstep) p.yaw = Math.atan2(p.dodgeDirX, p.dodgeDirZ);
}

/** Spawn this attack's projectiles or burst, if the style has any. */
function fireAttack(p: PlayerState, state: SimState, colliders: readonly Collider[]): void {
  const r = tuning.rangedCombo;
  const m = tuning.magicCombo;
  const hit = heroHit(p, p.attackHit);
  if (p.style === 'bow') {
    state.events.push({ kind: 'fire', playerId: p.id, projectile: 'arrow', heavy: hit.heavy });
    switch (p.attackHit) {
      case 2: // power shot
      case 4: // piercing shot before the backflip
        spawnArrow(state, p, hit, 0, r.powerArrowSpeed, true);
        break;
      case 3: // fan
        for (let i = 0; i < r.fanArrows; i++) {
          const u = r.fanArrows > 1 ? i / (r.fanArrows - 1) - 0.5 : 0;
          spawnArrow(state, p, hit, u * r.fanSpreadDeg * DEG, r.arrowSpeed, false);
        }
        break;
      default:
        spawnArrow(state, p, hit, 0, r.arrowSpeed, false);
    }
  } else if (p.style === 'staff') {
    const burst = p.attackHit === 2 || p.attackHit === 4;
    state.events.push({ kind: 'fire', playerId: p.id, projectile: burst ? 'burst' : 'bolt', heavy: hit.heavy });
    switch (p.attackHit) {
      case 2:
        spawnBurst(state, p, hit, colliders, m.burstRange, m.burstRadius);
        break;
      case 3: // nova: a ring of bolts in every direction
        for (let i = 0; i < m.novaBolts; i++) spawnBolt(state, p, hit, (i / m.novaBolts) * Math.PI * 2);
        break;
      case 4:
        spawnBurst(state, p, hit, colliders, m.greatBurstRange, m.greatBurstRadius);
        break;
      default:
        // Single bolts curve toward the soft target; Blink primes one to crit.
        spawnBolt(state, p, hit, 0, p.attackTarget, p.nextBoltCrit);
        p.nextBoltCrit = false;
    }
  } else {
    state.events.push({ kind: 'swing', playerId: p.id, heavy: hit.heavy, x: p.x, z: p.z, yaw: p.yaw, range: hit.range, arcDeg: hit.arcDeg });
  }
}

/**
 * Sword hit detection during the active phase: every enemy inside the swing's
 * range and arc takes one hit per swing. The slam (hit 5) only lands at the end.
 * Any contact freezes the knight briefly (hitstop).
 */
function swordHits(p: PlayerState, state: SimState, props?: readonly PropInfo[]): void {
  const hit = heroHit(p, p.attackHit);
  const isSlam = p.attackHit === 4;
  const from = hit.windup + (isSlam ? hit.active * tuning.combat.slamHitFrom : 0);
  if (p.attackTime < from || p.attackTime > hit.windup + hit.active) return;
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  // The slam lands a step ahead; swings are centred on the knight.
  const cx = p.x + (isSlam ? fx : 0);
  const cz = p.z + (isSlam ? fz : 0);
  if (isSlam && !p.attackHitIds.includes(-1)) {
    p.attackHitIds.push(-1);
    state.events.push({ kind: 'land', playerId: p.id, x: cx, z: cz, radius: hit.range });
  }
  // Crates and urns in reach break (D4); one already broken is gone, so a swing takes each once.
  if (props) smashArc(state, props, p, cx, cz, hit.range, hit.arcDeg);
  let stop = 0;
  for (const e of state.enemies) {
    if (!isTargetable(e) || p.attackHitIds.includes(e.id)) continue;
    // Swings don't reach enemies on another level (the ledge).
    if (Math.abs(e.y - p.y) > 1.2) continue;
    const er = enemyStats(e.kind).radius;
    const dx = e.x - cx;
    const dz = e.z - cz;
    const d = Math.hypot(dx, dz);
    if (d > hit.range + er) continue;
    if (hit.arcDeg < 360) {
      const off = Math.abs(wrapAngle(Math.atan2(e.x - p.x, e.z - p.z) - p.yaw));
      if (off > (hit.arcDeg * DEG) / 2) continue;
    }
    const dirX = d > 1e-3 ? dx / d : fx;
    const dirZ = d > 1e-3 ? dz / d : fz;
    p.attackHitIds.push(e.id);
    damageEnemy(state, e, {
      attackerId: p.id,
      damage: hit.damage,
      poise: hit.poise,
      knockback: hit.knockback,
      heavy: hit.heavy,
      dirX,
      dirZ,
      style: 'sword',
      x: e.x - dirX * er,
      y: e.y + Math.min(1.2, enemyStats(e.kind).height * 0.55),
      z: e.z - dirZ * er,
    });
    stop = Math.max(stop, hitstopFor(hit.heavy));
  }
  if (stop > 0) p.hitstop = Math.max(p.hitstop, stop);
}

/**
 * Light and heavy strings (C1): while attack is still held, a light step turns into the heavy for the
 * string so far once the hold reaches heavyHoldMs, and a heavy reaches charge level 2 after chargeMs
 * more. A tap never waits: it fires at the end of its windup as the slice's chain always did.
 */
function holdForHeavy(state: SimState, p: PlayerState, cmd: PlayerCommand): void {
  if (!cmd.attackHeld || p.attackHoldNext) return;
  const c = tuning.combo;
  const hold = (p.attackHold ?? 0) * 1000;
  if (p.attackCharge === undefined && hold >= c.heavyHoldMs) {
    const s = p.attackString ?? 'L';
    setStringMove(p, s.slice(0, -1) + 'H', true);
    p.attackTime = 0;
    aimLunge(state, p);
  } else if (p.attackCharge === 1 && hold >= c.heavyHoldMs + c.chargeMs) {
    p.attackCharge = 2;
  }
}

/** Whether a held attack should wait at the end of its windup rather than fire. */
function waitingOnHold(p: PlayerState, cmd: PlayerCommand): boolean {
  if (!cmd.attackHeld || p.attackHoldNext) return false;
  const c = tuning.combo;
  const hold = (p.attackHold ?? 0) * 1000;
  if (p.attackCharge === undefined) return hold < c.heavyHoldMs;
  return p.attackCharge === 1 && hold < c.heavyHoldMs + c.chargeMs;
}

/** A fight is on: the doors are shut on a room, or the arena's waves are running. */
export function fightOn(state: SimState): boolean {
  const phase = state.run.phase;
  return phase === 'intro' || phase === 'wave' || phase === 'rest';
}

/** Accelerate toward the commanded velocity, capped at maxSpeed; optionally turn to face it. */
function steer(p: PlayerState, cmd: PlayerCommand, moveMag: number, maxSpeed: number, dt: number, turn: boolean): void {
  const mv = tuning.movement;
  const tx = moveMag > 0.01 ? (cmd.moveX / moveMag) * maxSpeed : 0;
  const tz = moveMag > 0.01 ? (cmd.moveZ / moveMag) * maxSpeed : 0;
  const dvx = tx - p.vx;
  const dvz = tz - p.vz;
  const dvLen = Math.hypot(dvx, dvz);
  const speeding = Math.hypot(tx, tz) >= Math.hypot(p.vx, p.vz);
  const control = p.grounded ? 1 : tuning.jump.airControl;
  const maxDv = (speeding ? mv.acceleration : mv.deceleration) * control * dt;
  if (dvLen <= maxDv) {
    p.vx = tx;
    p.vz = tz;
  } else {
    p.vx += (dvx / dvLen) * maxDv;
    p.vz += (dvz / dvLen) * maxDv;
  }
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  if (turn && moveMag > 0.01) {
    p.yaw = turnToward(p.yaw, Math.atan2(cmd.moveX, cmd.moveZ), mv.turnRateDeg * DEG * dt * control);
  }
}

/**
 * Max health follows the level of the weapon in hand (Michael, 29 Oct): checked each tick, so a level
 * gained mid-fight or a change of weapon shows at once, in the server's step and the prediction alike.
 * Health keeps its share of the bar, so changing weapons is never a heal.
 */
/** Max health from a base, with healthPerLevel for each level of the weapon in hand. */
export function levelHealth(p: PlayerState, base: number): number {
  return Math.round(base + tuning.progression.healthPerLevel * (levelFor(p.xp[p.style]) - 1));
}

export function refreshLevelHealth(p: PlayerState): void {
  if (p.hpBase === undefined) return;
  const want = levelHealth(p, p.hpBase);
  if (want === p.maxHp) return;
  p.hp = p.maxHp > 0 ? (p.hp * want) / p.maxHp : want;
  p.maxHp = want;
}

export function stepPlayer(
  p: PlayerState,
  cmd: PlayerCommand,
  dt: number,
  world: World,
  state: SimState,
): void {
  const colliders = world.colliders;
  const mv = tuning.movement;
  const dg = tuning.dodge;
  refreshLevelHealth(p);
  p.invulnTime = Math.max(0, p.invulnTime - dt);
  if (cmd.aimPitch !== undefined) p.aimPitch = cmd.aimPitch;
  else delete p.aimPitch;

  // Down: outside a run, get back up after a while; on a generated floor that is once the room is
  // cleared. In a run you stay down: the slice's downs wait for a revive, Hearthgate's (T5) bleed
  // out. A wiped floor's party stays down (D10): the end card takes each home.
  if (p.mode === 'down') {
    const inRun = state.run.phase === 'intro' || state.run.phase === 'wave' || state.run.phase === 'rest';
    p.downTime -= dt;
    const wiped = !!state.floor && state.run.phase === 'lost';
    if (p.downTime <= 0 && !inRun && !wiped) {
      p.mode = 'move';
      p.hp = p.maxHp;
      p.invulnTime = tuning.combat.reviveInvulnMs / 1000;
      delete p.bleed;
      return;
    }
    if (p.bleed !== undefined && inRun) bleedAndCrawl(p, cmd, dt, world, state);
    return;
  }

  if (tuning.flow.enabled) {
    p.flow ??= newFlow();
    stepFlow(p, dt);
  }
  // How long attack has been held (C1): a hold long enough turns the step into a heavy.
  if (tuning.combo.heavies) {
    p.attackHold = cmd.attackHeld ? (p.attackHold ?? 0) + dt : 0;
    // A press made mid-swing is for the next swing in the chain: its hold must not turn this one heavy.
    if (cmd.attack && p.mode === 'attack') p.attackHoldNext = true;
  }

  // Interrupted by a heavy hit: shoved back, no control until it passes.
  if (p.mode === 'hurt') {
    p.hurtTime -= dt;
    const startX = p.x;
    const startZ = p.z;
    p.x += p.kbx * dt;
    p.z += p.kbz * dt;
    const friction = Math.exp(-tuning.combat.knockbackFriction * dt);
    p.kbx *= friction;
    p.kbz *= friction;
    if (groundHeight(world, p.x, p.z) > p.y + tuning.combat.stepHeight) {
      p.x = startX;
      p.z = startZ;
    }
    resolveCircle(p, mv.radius, p.y + 0.3, p.y + mv.height, colliders);
    settleVertical(p, world, dt);
    if (p.hurtTime <= 0) p.mode = 'move';
    return;
  }

  // Hitstop: frozen in place; clicks and dodges still buffer so nothing gets eaten.
  if (p.hitstop > 0) {
    p.hitstop = Math.max(0, p.hitstop - dt);
    if (cmd.attack && p.mode === 'attack') {
      p.attackQueued = true;
      // A press in a hit's freeze can still be on the beat (C2).
      if (p.flow) {
        const h = heroHit(p, p.attackHit);
        p.flow.nextOnBeat = onBeat(p.attackTime, h.windup + h.active);
      }
    }
    if (cmd.dodge) p.dodgeBuffered = true;
    if (p.mode === 'guard') p.guardTime += dt;
    return;
  }
  const wantDodge = cmd.dodge || p.dodgeBuffered;
  p.dodgeBuffered = false;
  const blockPressed = cmd.block && !p.blockWasHeld;
  p.blockWasHeld = cmd.block;

  // Dodge charges recharge one at a time.
  if (p.dodgeCharges < dg.charges) {
    p.dodgeRecharge += dt;
    if (p.dodgeRecharge >= (dg.chargeRechargeMs / 1000) * (1 - dodgeRechargeCut(p))) {
      p.dodgeRecharge = 0;
      p.dodgeCharges++;
    }
  } else {
    p.dodgeCharges = Math.min(p.dodgeCharges, dg.charges);
    p.dodgeRecharge = 0;
  }
  p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
  // Every style's abilities cool down, active or not, so swapping is a tactic.
  for (const cds of Object.values(p.cooldowns)) {
    cds[0] = Math.max(0, cds[0] - dt);
    cds[1] = Math.max(0, cds[1] - dt);
  }
  if (p.offhandCooldown !== undefined) p.offhandCooldown = Math.max(0, p.offhandCooldown - dt);
  if (p.potionCooldown !== undefined) p.potionCooldown = Math.max(0, p.potionCooldown - dt);
  if (cmd.drink) drinkPotion(state, p);
  const abilitySlot: 0 | 1 | 2 | null = cmd.ability1 ? 0 : cmd.ability2 ? 1 : cmd.ability3 ? 2 : null;
  // One weapon set per outing (C3): a change of weapon waits until no fight is on.
  if (cmd.swapTo && cmd.swapTo !== p.style && (tuning.combo.swapInFight || !fightOn(state))) p.queuedSwap = cmd.swapTo;

  const moveMag = Math.min(1, Math.hypot(cmd.moveX, cmd.moveZ));
  const canDodge = p.grounded && p.dodgeCharges > 0 && p.dodgeCooldown <= 0;

  // The roll's tail: attacks and Q/E pressed during it are kept; past cancelAfterMs any input ends it.
  if (p.mode === 'dodge') {
    if (cmd.attack) p.attackQueued = true;
    if (abilitySlot !== null) p.queuedAbility = abilitySlot;
    const wantsOut = p.attackQueued || p.queuedAbility >= 0 || wantDodge || cmd.jump || cmd.block || moveMag > 0.01;
    if (p.dodgeTime * 1000 >= dodgeCancelMs(p) && wantsOut) {
      // A roll cut short keeps its i-frames (D9): a quicker way out must not make the dodge leakier.
      if (dg.keepIframesOnCancel) p.invulnTime = Math.max(p.invulnTime, dg.iframesMs / 1000 - p.dodgeTime);
      endDodge(p);
    }
  }

  // --- Action starts ---
  if (p.mode === 'attack') {
    const hit = heroHit(p, p.attackHit);
    const chainOpen = hit.windup + hit.active;
    const inRecovery = p.attackTime >= chainOpen;
    // Q/E during a windup are held until recovery, like the attack buffer.
    if (abilitySlot !== null && !inRecovery) p.queuedAbility = abilitySlot;
    const slot = abilitySlot ?? (p.queuedAbility >= 0 ? (p.queuedAbility as 0 | 1 | 2) : null);
    if (wantDodge && canDodge && (inRecovery || tuning.dodge.cancelsAttacks)) {
      // Dodge interrupts the attack (any time, Michael's call; the brief allowed recovery only).
      p.queuedAbility = -1;
      p.attackQueued = false;
      startDodge(state, p, cmd, moveMag);
    } else if (blockPressed && p.grounded && (inRecovery || tuning.guard.cancelsAttacks)) {
      p.queuedAbility = -1;
      p.attackQueued = false;
      raiseGuard(state, p);
    } else if (slot !== null && inRecovery && abilityReady(p, slot)) {
      // Abilities cancel recovery too.
      p.queuedAbility = -1;
      startAbility(state, p, slot, cmd);
    } else if (p.queuedSwap && inRecovery) {
      // Swapping style also cancels recovery, so it works as a mid-fight tactic.
      p.style = p.queuedSwap;
      p.queuedSwap = null;
      p.queuedAbility = -1;
      p.mode = 'move';
      p.attackQueued = false;
    } else if (cmd.attack && p.attackTime >= chainOpen - tuning.combo.inputBufferMs / 1000) {
      p.attackQueued = true;
      // Flow (C2): the beat is the moment the chain's next step opens, judged on the tick of the press.
      if (p.flow) p.flow.nextOnBeat = onBeat(p.attackTime, chainOpen);
    }
  } else if (p.mode === 'ability') {
    // Dodge can cancel an ability's recovery.
    const tm = abilityTiming(p.ability);
    if (wantDodge && canDodge && p.abilityTime >= tm.windup + tm.active) {
      p.invulnerable = false;
      startDodge(state, p, cmd, moveMag);
    }
  } else if (p.mode === 'move') {
    if (p.queuedSwap) {
      p.style = p.queuedSwap;
      p.queuedSwap = null;
    }
    const queued = p.queuedAbility >= 0 ? (p.queuedAbility as 0 | 1 | 2) : null;
    p.queuedAbility = -1;
    const slot = abilitySlot ?? queued;
    if (wantDodge && canDodge) startDodge(state, p, cmd, moveMag);
    else if (slot !== null && p.grounded && abilityReady(p, slot)) startAbility(state, p, slot, cmd);
    else if ((cmd.attack || p.attackQueued) && p.grounded) startAttack(state, p, 0, cmd, moveMag);
    else if (cmd.block && p.grounded) raiseGuard(state, p);
    else if (cmd.jump && p.grounded) {
      const j = tuning.jump;
      p.vy = Math.sqrt(2 * j.gravity * j.height);
      p.grounded = false;
    }
  } else if (p.mode === 'guard') {
    // Guard: hold to keep it up. Anything else lowers it and goes straight into that action.
    if (p.queuedSwap) {
      p.style = p.queuedSwap;
      p.queuedSwap = null;
    }
    if (wantDodge && canDodge) startDodge(state, p, cmd, moveMag);
    else if (abilitySlot !== null && abilityReady(p, abilitySlot)) startAbility(state, p, abilitySlot, cmd);
    else if (cmd.attack) startAttack(state, p, 0, cmd, moveMag);
    else if (!cmd.block) p.mode = 'move';
  }

  // --- Horizontal motion ---
  const startX = p.x;
  const startZ = p.z;
  if (p.mode === 'dodge') {
    const T = dg.durationMs / 1000;
    const u0 = p.dodgeTime / T;
    p.dodgeTime += dt;
    const u1 = p.dodgeTime / T;
    const step = p.dodgeDist * (dodgeCurve(u1) - dodgeCurve(u0));
    p.x += p.dodgeDirX * step;
    p.z += p.dodgeDirZ * step;
    p.vx = (p.dodgeDirX * step) / dt;
    p.vz = (p.dodgeDirZ * step) / dt;
    p.invulnerable = p.dodgeTime * 1000 < dg.iframesMs;
    if (p.dodgeTime >= T) endDodge(p);
  } else if (p.mode === 'attack') {
    if (tuning.combo.heavies && !p.attackFired) holdForHeavy(state, p, cmd);
    const hit = heroHit(p, p.attackHit);
    const t0 = p.attackTime;
    // A held attack waits at the end of its windup: for the heavy, or for charge level 2.
    if (!(tuning.combo.heavies && !p.attackFired && t0 + dt >= hit.windup && waitingOnHold(p, cmd))) p.attackTime += dt;

    const windup = hit.windup;
    if (!p.attackFired && p.attackTime >= windup) {
      // A charged heavy at a full meter is a Crescendo (C2): it spends the meter and hits much harder.
      if (p.flow && p.attackCharge === 2 && p.flow.v >= tuning.flow.max) {
        p.attackCharge = 3;
        p.flow.v = 0;
      }
      armFlow(p);
      fireAttack(p, state, colliders);
      p.attackFired = true;
      if (p.attackMove) state.events.push({ kind: 'stringMove', playerId: p.id, move: p.attackMove, charge: p.attackCharge ?? 0 });
    }
    if (p.style === 'sword') swordHits(p, state, world.level.dungeon?.props);

    if (p.style === 'sword' || p.attackLunge !== 0) {
      // Melee roots the hero, and leaps commit to their path: only the attack's lunge moves them.
      let step = p.attackLunge * (lungeCurve(p.attackTime, windup, hit.active) - lungeCurve(t0, windup, hit.active));
      // Lunges toward a target stop short of it (brief: 0.8 m).
      const target = step > 0 ? state.enemies.find((e) => e.id === p.attackTarget && isTargetable(e)) : undefined;
      if (target) {
        const stop = tuning.targeting.lungeStopShort + enemyStats(target.kind).radius + tuning.movement.radius;
        step = Math.min(step, Math.max(0, Math.hypot(target.x - p.x, target.z - p.z) - stop));
      }
      p.x += Math.sin(p.yaw) * step;
      p.z += Math.cos(p.yaw) * step;
      p.vx = 0;
      p.vz = 0;
    } else {
      // Ranged and magic: walk while attacking, facing stays on the shot; with free aim (D12) the
      // shot follows the reticle while it is drawn, so it leaves where the player points at release.
      steer(p, cmd, moveMag, mv.runSpeed * tuning.combo.castMoveSpeedFrac * moveSpeedMult(p), dt, false);
      if (freeAim(p, cmd)) p.yaw = Math.atan2(cmd.aimX, cmd.aimZ);
    }

    const chainOpen = windup + hit.active;
    const heldSlot = p.queuedAbility >= 0 ? (p.queuedAbility as 0 | 1 | 2) : null;
    if (p.attackTime >= chainOpen && heldSlot !== null && abilityReady(p, heldSlot)) {
      // A held Q/E beats the next swing in the chain.
      p.queuedAbility = -1;
      p.attackQueued = false;
      startAbility(state, p, heldSlot, cmd);
    } else if (p.attackTime >= chainOpen && p.queuedSwap) {
      // So does a held hero swap.
      p.style = p.queuedSwap;
      p.queuedSwap = null;
      p.attackQueued = false;
      p.mode = 'move';
    } else if (p.attackQueued && p.attackTime >= chainOpen) {
      // Chains are 3 hits until levels unlock steps 4 and 5.
      const fam = familyOf(p);
      const length = Math.min(chainLengthFor(levelFor(p.xp[p.style])), fam ? FAMILY_ANIM[fam].length : 5);
      if (tuning.combo.heavies) {
        // The next light is the step after the string so far; a string as long as the chain starts again.
        const s = p.attackString ?? '';
        const prior = s.length >= length ? '' : s;
        startAttack(state, p, prior.length, cmd, moveMag, prior);
      } else startAttack(state, p, ((p.attackStep ?? p.attackHit) + 1) % length, cmd, moveMag);
    } else if (p.attackTime >= chainOpen + hit.recovery) {
      p.mode = 'move';
      p.attackQueued = false;
    }
  } else if (p.mode === 'ability') {
    if (stepAbility(state, p, cmd, dt, colliders, world.level.dungeon?.props)) {
      p.mode = 'move';
      p.invulnerable = false;
    }
  } else if (p.mode === 'guard') {
    // Slow strafe behind the guard, still facing the camera.
    p.guardTime += dt;
    steer(p, cmd, moveMag, mv.runSpeed * tuning.guard.moveSpeedFrac * moveSpeedMult(p), dt, false);
    if (Math.hypot(cmd.aimX, cmd.aimZ) > 0.01) p.yaw = turnToward(p.yaw, Math.atan2(cmd.aimX, cmd.aimZ), mv.faceTurnRateDeg * DEG * dt);
  } else {
    const run = moveMag >= mv.runThreshold;
    // How much of the move is forward relative to facing (1 forward, 0 sideways, -1 back).
    const fwd = moveMag > 0.01 ? (cmd.moveX * Math.sin(p.yaw) + cmd.moveZ * Math.cos(p.yaw)) / moveMag : 1;
    let dirScale = 1;
    if (mv.faceCamera) {
      dirScale =
        fwd >= 0
          ? mv.strafeSpeedFrac + (1 - mv.strafeSpeedFrac) * fwd
          : mv.strafeSpeedFrac + (mv.backpedalSpeedFrac - mv.strafeSpeedFrac) * -fwd;
    }
    // Sprint is a forward run only.
    const sprinting = cmd.sprint && p.grounded && (!mv.faceCamera || fwd > 0.5);
    const runSpeed = sprinting ? mv.sprintSpeed : mv.runSpeed;
    const speed = (run ? runSpeed : mv.walkSpeed * Math.min(1, moveMag / mv.runThreshold)) * dirScale * moveSpeedMult(p);
    steer(p, cmd, moveMag, speed, dt, !mv.faceCamera);
    if (mv.faceCamera && Math.hypot(cmd.aimX, cmd.aimZ) > 0.01) {
      const control = p.grounded ? 1 : tuning.jump.airControl;
      p.yaw = turnToward(p.yaw, Math.atan2(cmd.aimX, cmd.aimZ), mv.faceTurnRateDeg * DEG * dt * Math.max(control, 0.6));
    }
  }

  // Can't step up anything taller than a small lip (ledge faces, ramp sides).
  if (groundHeight(world, p.x, p.z) > p.y + tuning.combat.stepHeight) {
    p.x = startX;
    p.z = startZ;
  }

  settleVertical(p, world, dt);

  const before = { x: p.x, z: p.z };
  resolveCircle(p, mv.radius, p.y + 0.3, p.y + mv.height, colliders);
  // Kill velocity into whatever we hit so we slide instead of grinding.
  const px = p.x - before.x;
  const pz = p.z - before.z;
  const pushLen = Math.hypot(px, pz);
  if (pushLen > 1e-6) {
    const nx = px / pushLen;
    const nz = pz / pushLen;
    const into = p.vx * nx + p.vz * nz;
    if (into < 0) {
      p.vx -= into * nx;
      p.vz -= into * nz;
    }
  }
}

/**
 * The village's doors (Michael, 28 Oct: enterable interiors): a standing hero who steps into one is
 * put on its other side, facing in. In stepSim, after everyone has moved, and never in prediction:
 * a hero grazing a door's edge could be through in the browser and not on the server, and snap back
 * from inside. So the server alone decides, and the browser's hero follows a snapshot later. Each
 * side's arrival lies outside the other's circle, so nobody bounces back.
 */
export function stepDoors(state: SimState, world: World): void {
  const doors = world.level.village?.doors;
  if (!doors) return;
  // A henchman keeps to its nearest player (P3), and a door is a jump a walk cannot follow: when that
  // player takes one, the henchman comes through with them.
  const leaders = new Map<PlayerState, PlayerState>();
  for (const h of state.players) {
    if (!h.henchman || h.mode === 'down') continue;
    let best: PlayerState | null = null;
    for (const p of state.players) {
      if (p.henchman || p.mode === 'down') continue;
      if (!best || Math.hypot(p.x - h.x, p.z - h.z) < Math.hypot(best.x - h.x, best.z - h.z)) best = p;
    }
    if (best) leaders.set(h, best);
  }
  for (const p of state.players) {
    if (p.mode === 'down') continue;
    for (const d of doors) {
      if (Math.hypot(p.x - d.x, p.z - d.z) > d.radius) continue;
      through(p, d, 0);
      if (!p.henchman) {
        let n = 0;
        for (const [h, leader] of leaders) if (leader === p) through(h, d, ++n);
      }
      break;
    }
  }
}

/** Out of a door: the nth henchman behind its player stands a step to one side, then the other. */
function through(p: PlayerState, d: { toX: number; toZ: number; toYawDeg: number }, n: number): void {
  const yaw = d.toYawDeg * DEG;
  const side = n === 0 ? 0 : (n % 2 === 1 ? 1 : -1) * Math.ceil(n / 2) * 0.9;
  p.x = d.toX + Math.cos(yaw) * side;
  p.z = d.toZ - Math.sin(yaw) * side;
  p.yaw = yaw;
  p.vx = 0;
  p.vz = 0;
}

/**
 * A downed hero in a fight (Hearthgate's downs, T5): the bleed-out runs down, and until it does
 * they drag themselves along at coop.crawlSpeed, toward a friend or out of harm's way. Once it is
 * out they lie still until the room is cleared or a Revive Draught brings them back.
 */
function bleedAndCrawl(p: PlayerState, cmd: PlayerCommand, dt: number, world: World, state: SimState): void {
  if (p.bleed! <= 0) return;
  p.bleed! -= dt;
  if (p.bleed! <= 0) {
    p.bleed = 0;
    p.reviveProgress = 0;
    state.events.push({ kind: 'bledOut', playerId: p.id });
    return;
  }
  const mag = Math.min(1, Math.hypot(cmd.moveX, cmd.moveZ));
  if (mag < 0.05) return;
  const dirX = cmd.moveX / mag;
  const dirZ = cmd.moveZ / mag;
  const startX = p.x;
  const startZ = p.z;
  p.x += dirX * mag * tuning.coop.crawlSpeed * dt;
  p.z += dirZ * mag * tuning.coop.crawlSpeed * dt;
  p.yaw = turnToward(p.yaw, Math.atan2(dirX, dirZ), tuning.movement.turnRateDeg * DEG * 0.25 * dt);
  if (groundHeight(world, p.x, p.z) > p.y + tuning.combat.stepHeight) {
    p.x = startX;
    p.z = startZ;
  }
  settleVertical(p, world, dt);
  resolveCircle(p, tuning.movement.radius, p.y + 0.3, p.y + tuning.movement.height, world.colliders);
}

/** Out of the roll, carrying a little momentum so it flows into running. */
function endDodge(p: PlayerState): void {
  p.mode = 'move';
  p.invulnerable = false;
  const carry = Math.min(Math.hypot(p.vx, p.vz), tuning.movement.runSpeed * 0.5);
  p.vx = p.dodgeDirX * carry;
  p.vz = p.dodgeDirZ * carry;
}

/** Raise the guard. A fresh raise opens the parry window, unless the last one was too recent (no mashing). */
function raiseGuard(state: SimState, p: PlayerState): void {
  p.mode = 'guard';
  p.guardTime = 0;
  p.parryOpen = state.time - p.guardRaisedAt >= tuning.guard.parryRearmMs / 1000;
  p.guardRaisedAt = state.time;
  p.invulnerable = false;
}

/** Ground is the floor, the ledge top or a ramp: follow it, fall off edges, land on whatever is below. */
function settleVertical(p: PlayerState, world: World, dt: number): void {
  const ground = groundHeight(world, p.x, p.z);
  if (p.grounded) {
    if (ground < p.y - tuning.combat.stepHeight) {
      p.grounded = false;
      p.vy = 0;
    } else {
      p.y = ground;
    }
  }
  if (!p.grounded) {
    p.vy -= tuning.jump.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= ground) {
      p.y = ground;
      p.vy = 0;
      p.grounded = true;
    }
  }
}
