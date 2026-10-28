import { tuning } from '../config/tuning';
import type { PlayerState, SimState } from './types';

/**
 * Flow (C2; Michael, 28 Oct): a rhythm meter on the hero. Hits pressed on the beat (as the chain's
 * next step opens), perfect parries and dodges, and combo payoffs fill it; repeating the same chain
 * earns half; a hit taken costs a tier; it drains when the fighting stops. Three tiers, then a
 * Crescendo: a charged heavy at a full meter. The beat is judged by the tick a press was made for,
 * which the server and the prediction both know exactly, so nothing here waits on the network.
 */
export interface FlowState {
  /** 0 to tuning.flow.max; a tier every third. */
  v: number;
  /** Seconds since the meter last grew. */
  idle: number;
  /** What the current attack earns once it lands. */
  pending: number;
  /** The last two chains played to their end, to tell variety from repetition. */
  chains: string[];
  /** Whether the press queued for the next attack, and the press behind this one, were on the beat. */
  nextOnBeat: boolean;
  onBeat: boolean;
  /** This dodge has already been paid for slipping a hit. */
  dodged: boolean;
}

export function newFlow(): FlowState {
  return { v: 0, idle: 0, pending: 0, chains: [], nextOnBeat: false, onBeat: false, dodged: false };
}

/** 0 to 3: a third of the meter each. */
export function flowTier(p: PlayerState | undefined): number {
  const v = p?.flow?.v ?? 0;
  const third = tuning.flow.max / 3;
  return v >= tuning.flow.max ? 3 : Math.floor(v / third);
}

export function gainFlow(p: PlayerState | undefined, amount: number): void {
  const f = p?.flow;
  if (!f || amount <= 0) return;
  f.v = Math.min(tuning.flow.max, f.v + amount);
  f.idle = 0;
}

/** A hit taken knocks the meter down a tier's worth, not to nothing. */
export function loseFlowTier(p: PlayerState): void {
  if (p.flow) p.flow.v = Math.max(0, p.flow.v - tuning.flow.max / 3);
}

/** The meter drains once the fighting has stopped a while. */
export function stepFlow(p: PlayerState, dt: number): void {
  const f = p.flow;
  if (!f) return;
  f.idle += dt;
  if (f.idle * 1000 > tuning.flow.idleMs) f.v = Math.max(0, f.v - tuning.flow.drainPerSec * dt);
}

/** A press at this point of an attack is on the beat: just before or just after the chain's next step opens. */
export function onBeat(attackTime: number, chainOpen: number): boolean {
  const fl = tuning.flow;
  return attackTime >= chainOpen - fl.beatEarlyMs / 1000 && attackTime <= chainOpen + fl.beatLateMs / 1000;
}

/** An attack is firing: what it will earn once it lands, halved when the same chain is played a third time running. */
export function armFlow(p: PlayerState): void {
  const f = p.flow;
  if (!f) return;
  const fl = tuning.flow;
  const heavy = p.attackCharge !== undefined;
  let gain = heavy ? (f.onBeat ? fl.heavyOnBeat : fl.heavyOffBeat) : f.onBeat ? fl.lightOnBeat : fl.lightOffBeat;
  const s = p.attackString ?? '';
  const [a, b] = f.chains;
  if (a !== undefined && a === b && s && b.startsWith(s)) gain *= fl.repeatFrac;
  f.pending = gain;
}

/** A chain ended (a new one is starting): remember it, to tell variety from repetition. */
export function chainEnded(p: PlayerState, played: string | undefined): void {
  const f = p.flow;
  if (!f || !played) return;
  f.chains = [...f.chains.slice(-1), played];
}

/** Flow I: attacks a little faster. */
export function flowSpeed(p: PlayerState): number {
  return flowTier(p) >= 1 ? tuning.flow.tier1Speed : 0;
}

/** Flow III: a heavy hit lands but does not interrupt. */
export function flowArmoured(p: PlayerState): boolean {
  return flowTier(p) >= 3;
}

/** Harmony: the payer and another player both at Flow III add to a combo payoff. */
export function harmonyBonus(state: SimState, p: PlayerState | undefined): number {
  if (!p?.flow || flowTier(p) < 3) return 0;
  return state.players.some((o) => o !== p && flowTier(o) >= 3) ? tuning.flow.harmonyBonus : 0;
}
