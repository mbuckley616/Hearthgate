/**
 * States and combo payoffs. Pure and deterministic like sim.ts: time is the `now`
 * argument and nothing here reads a clock. Tuning is STATES and COMBO in sim.ts.
 *
 * A state sits on a target until it expires or an attack with the right tag consumes it.
 * Each state remembers who applied it (refreshing it adds to the list), so the payoff can
 * count distinct contributors: everyone who set it up, plus whoever finishes it.
 */
import { COMBO, STATES } from "./sim";

export type StateKind = keyof typeof STATES;

// A literal rather than Object.keys(STATES): sim.ts imports this module, so STATES may
// not be initialised yet when this line runs.
export const STATE_KINDS: readonly StateKind[] = ["soaked", "staggered", "marked", "burning", "rooted", "chilled"];

/**
 * What an attack is, for the purpose of states. Abilities and weapons tag their hits;
 * the plain sword swing is just "melee".
 */
export type HitTag =
  | "melee"
  | "ranged"
  | "magic"
  | "area"
  | "lightning"
  | "frost"
  | "fire"
  | "water"
  | "oil"
  | "wind"
  | "backstab"
  | "execute"
  | "shatter";

export interface ActiveState {
  until: number;
  /** Distinct appliers, in the order they first applied it. */
  by: string[];
}

export type StateSet = Partial<Record<StateKind, ActiveState>>;

/** One payoff that fired on a hit; the server turns these into events and side effects. */
export type ComboEffect =
  | { kind: "chain"; radius: number; damage: number; contributors: number }
  | { kind: "freeze"; durationMs: number; contributors: number }
  | { kind: "crit"; knockdownMs: number; contributors: number }
  | { kind: "spread"; radius: number; contributors: number }
  | { kind: "undodgeable"; contributors: number }
  | { kind: "shatter"; contributors: number }
  | { kind: "marked"; contributors: number };

export interface HitResult {
  /** Damage to the target after every payoff. */
  damage: number;
  consumed: StateKind[];
  effects: ComboEffect[];
}

export function hasState(s: StateSet, kind: StateKind, now: number): boolean {
  const a = s[kind];
  return a !== undefined && now < a.until;
}

/** Apply or refresh a state. Refreshing extends it to a full duration and adds the applier. */
export function applyState(s: StateSet, kind: StateKind, byId: string, now: number): void {
  const until = now + STATES[kind].durationMs;
  const a = s[kind];
  if (a && now < a.until) {
    a.until = Math.max(a.until, until);
    if (!a.by.includes(byId)) a.by.push(byId);
  } else {
    s[kind] = { until, by: [byId] };
  }
}

/** Drop expired states. Call once a tick. */
export function expireStates(s: StateSet, now: number): void {
  for (const k of STATE_KINDS) {
    const a = s[k];
    if (a && now >= a.until) delete s[k];
  }
}

/** Distinct players behind a payoff: the state's appliers plus the finisher. */
export function contributors(a: ActiveState, finisherId: string): number {
  return a.by.includes(finisherId) ? a.by.length : a.by.length + 1;
}

/** 1 for a solo payoff, +perContributor for each other distinct player, capped. */
export function comboMultiplier(n: number): number {
  const counted = Math.min(Math.max(1, n), COMBO.maxContributors);
  return 1 + COMBO.perContributor * (counted - 1);
}

/** Which tags consume which state (design doc, the "Consumed by" column). */
const CONSUMERS: Record<Exclude<StateKind, "marked">, readonly HitTag[]> = {
  soaked: ["lightning", "frost"],
  staggered: ["backstab", "execute"],
  burning: ["oil", "wind"],
  rooted: ["area"],
  chilled: ["shatter"]
};

/**
 * Resolve one hit against a target's states: consume what the hit's tags consume, apply
 * the payoffs, and return the final damage and the effects for the caller to carry out
 * (chain and spread need the other enemies, freeze and knockdown change the target's AI).
 * Marked is never consumed: it adds to every hit from anyone while it lasts.
 */
export function resolveHit(
  s: StateSet,
  hit: { damage: number; tags: readonly HitTag[]; byId: string },
  now: number
): HitResult {
  let damage = hit.damage;
  const consumed: StateKind[] = [];
  const effects: ComboEffect[] = [];
  const has = (t: HitTag) => hit.tags.includes(t);

  for (const kind of ["soaked", "staggered", "burning", "rooted", "chilled"] as const) {
    const a = s[kind];
    if (!a || now >= a.until || !CONSUMERS[kind].some(has)) continue;
    const n = contributors(a, hit.byId);
    const mult = comboMultiplier(n);
    consumed.push(kind);
    delete s[kind];
    switch (kind) {
      case "soaked":
        if (has("lightning")) {
          effects.push({ kind: "chain", radius: COMBO.chainRadius, damage: Math.round(hit.damage * COMBO.chainShare * mult), contributors: n });
        } else {
          const durationMs = Math.round(COMBO.freezeMs * mult);
          s.rooted = { until: now + durationMs, by: [...a.by] };
          s.chilled = { until: now + durationMs, by: [...a.by] };
          effects.push({ kind: "freeze", durationMs, contributors: n });
        }
        break;
      case "staggered":
        damage = damage * COMBO.staggerCritMult * mult;
        effects.push({ kind: "crit", knockdownMs: COMBO.knockdownMs, contributors: n });
        break;
      case "burning":
        effects.push({ kind: "spread", radius: COMBO.spreadRadius, contributors: n });
        break;
      case "rooted":
        damage = damage * mult;
        effects.push({ kind: "undodgeable", contributors: n });
        break;
      case "chilled":
        damage = damage + COMBO.shatterBonus * mult;
        effects.push({ kind: "shatter", contributors: n });
        break;
    }
  }

  const mark = s.marked;
  if (mark && now < mark.until) {
    const n = contributors(mark, hit.byId);
    damage += hit.damage * COMBO.markedBonus * comboMultiplier(n);
    effects.push({ kind: "marked", contributors: n });
  }

  return { damage: Math.round(damage), consumed, effects };
}
