import type { EnemyState, PlayerState, ProjectileState, SimState, Telegraph } from '../sim/types';
import type { ToPeer } from './protocol';

/**
 * A snapshot's shape on the wire (Fable, "Snapshots that stay small in a crowd"). Every snapshot is
 * the whole SimState, and as keyed objects a crowd cost about 670 bytes an enemy: msgpack sends each
 * key's name with every enemy, and most of an enemy's 37 fields sit at their resting value. Here the
 * enemies, players and projectiles travel as rows: their fields' values in a fixed order with no
 * names, a field at its resting value as nil (one byte), trailing nils left off, and anything the
 * fixed list does not name (an optional field: `risen`, `crown`, a henchman's `brain`) in an object
 * at the row's end. The packing is lossless: the browser unpacks the same SimState the server
 * stepped, field for field, so prediction, the views and the parity test cannot tell, and every
 * snapshot still stands alone (a join, a hand-off and a lost snapshot need nothing before it).
 *
 * A field added to EnemyState, PlayerState or ProjectileState as required must be added to its
 * list below, or the typecheck fails (`Unlisted`); an optional one needs nothing. A change to a
 * list changes the wire, so it bumps PROTOCOL_VERSION.
 */

/** One row: a field's value, or null for its resting value; then, if any, the fields the list does not name. */
export type PackedRow = unknown[];

export interface PackedState extends Omit<SimState, 'players' | 'enemies' | 'projectiles'> {
  players: PackedRow[];
  enemies: PackedRow[];
  projectiles: PackedRow[];
}

/** The snapshot message as it travels; every other message travels as it is. */
export type SnapWire = Omit<Extract<ToPeer, { k: 'snap' }>, 's'> & { p: PackedState };
export type ToPeerWire = Exclude<ToPeer, { k: 'snap' }> | SnapWire;

interface Schema {
  fields: readonly string[];
  /** Resting values, by field: sent as nil. A field with none is always sent. */
  rest: Record<string, unknown>;
  /** Fields that are rows themselves. */
  nested?: Record<string, Schema>;
  /** The fields as a set, made on first use. */
  named?: Set<string>;
}

type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];
/** The required fields of T a list leaves out: must be never. */
type Unlisted<T, L extends readonly (keyof T)[]> = Exclude<RequiredKeys<T>, L[number]>;
const listsAll = <T>() => <L extends readonly (keyof T)[]>(list: L & (Unlisted<T, L> extends never ? unknown : { missing: Unlisted<T, L> })): L => list;

const TELE_FIELDS = listsAll<Telegraph>()(['shape', 'x', 'z', 'radius', 'yaw', 'arcDeg'] as const);
const TELE: Schema = { fields: TELE_FIELDS, rest: { shape: 'none', x: 0, z: 0, radius: 0, yaw: 0, arcDeg: 0 } };

// Ordered so the fields most often away from rest come first and an idle row ends early.
const ENEMY_FIELDS = listsAll<EnemyState>()([
  'id', 'kind', 'x', 'z', 'yaw', 'hp', 'ai', 'aiTime', 'maxHp', 'poise', 'y', 'vx', 'vz', 'strafeDir', 'cooldown', 'poiseWait',
  'lastHitAt', 'hasToken', 'tele', 'kbx', 'kbz', 'hitstop', 'flinch', 'slowTime', 'frozen', 'recoverTime', 'attack',
  'shatterUntil', 'skewerUntil', 'detonateUntil', 'bleedTicks', 'bleedTimer', 'bleedOwner', 'phase', 'summoned',
] as const);
const ENEMY: Schema = {
  fields: ENEMY_FIELDS,
  rest: {
    y: 0, vx: 0, vz: 0, kbx: 0, kbz: 0, aiTime: 0, hitstop: 0, flinch: 0, slowTime: 0, frozen: 0, bleedTicks: 0, bleedTimer: 0,
    bleedOwner: '', hasToken: false, cooldown: 0, poiseWait: 0, lastHitAt: -1, strafeDir: 1, recoverTime: 0, phase: 1,
    summoned: false, attack: '', shatterUntil: -1, skewerUntil: -1, detonateUntil: -1, tele: TELE.rest,
  },
  nested: { tele: TELE },
};

const PROJECTILE_FIELDS = listsAll<ProjectileState>()([
  'id', 'kind', 'owner', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'age', 'life', 'stuck', 'charged', 'radius', 'damage', 'poise',
  'knockback', 'heavy', 'pierce', 'hitIds', 'slowTime', 'resolved', 'targetId', 'homingLeft', 'crit', 'hostile', 'style',
  'chained', 'marks', 'comboed',
] as const);
const PROJECTILE: Schema = {
  fields: PROJECTILE_FIELDS,
  rest: {
    y: 0, vy: 0, stuck: false, charged: false, radius: 0, poise: 0, knockback: 0, heavy: false, pierce: 0, slowTime: 0,
    resolved: false, targetId: -1, homingLeft: 0, crit: false, hostile: false, chained: false, marks: false, comboed: false,
  },
};

const PLAYER_FIELDS = listsAll<PlayerState>()([
  'id', 'x', 'y', 'z', 'yaw', 'mode', 'hp', 'maxHp', 'vx', 'vy', 'vz', 'grounded', 'style', 'name', 'xp', 'mods', 'talents',
  'cooldowns', 'attackHit', 'attackTime', 'attackFired', 'attackQueued', 'attackSeq', 'attackHitIds', 'attackTarget',
  'attackLunge', 'ability', 'abilityTime', 'abilityFired', 'abilityTicks', 'abilitySeq', 'abilityHitIds', 'dodgeTime',
  'dodgeDirX', 'dodgeDirZ', 'dodgeDist', 'dodgeBackstep', 'dodgeBuffered', 'dodgeCharges', 'dodgeRecharge', 'dodgeCooldown',
  'guardTime', 'guardRaisedAt', 'parryOpen', 'parrySeq', 'blockSeq', 'blockWasHeld', 'reviveProgress', 'lagGrace',
  'invulnerable', 'hitstop', 'downTime', 'invulnTime', 'nextBoltCrit', 'queuedAbility', 'queuedSwap', 'lastFinisherAt',
  'hurtTime', 'kbx', 'kbz',
] as const);
const PLAYER: Schema = {
  fields: PLAYER_FIELDS,
  rest: {
    y: 0, vx: 0, vy: 0, vz: 0, grounded: true, mode: 'move', attackHit: 0, attackTime: 0, attackFired: false, attackQueued: false,
    attackSeq: 0, attackTarget: -1, attackLunge: 0, ability: 'charge', abilityTime: 0, abilityFired: false, abilityTicks: 0,
    abilitySeq: 0, dodgeTime: 0, dodgeDirX: 0, dodgeDirZ: 0, dodgeBackstep: false, dodgeBuffered: false, dodgeRecharge: 0,
    dodgeCooldown: 0, guardTime: 0, guardRaisedAt: -1000, parryOpen: false, parrySeq: 0, blockSeq: 0, blockWasHeld: false,
    reviveProgress: 0, lagGrace: 0, invulnerable: false, hitstop: 0, downTime: 0, invulnTime: 0, nextBoltCrit: false,
    queuedAbility: -1, queuedSwap: null, lastFinisherAt: -1, hurtTime: 0, kbx: 0, kbz: 0,
  },
};

/** Plain JSON data, compared as the sim compares it (so -0 is not 0: atan2 tells them apart). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return typeof a !== 'number' || Object.is(a, b);
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!(k in b) || !same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

function packRow(o: object, schema: Schema): PackedRow {
  const src = o as Record<string, unknown>;
  const row: unknown[] = [];
  let extra: Record<string, unknown> | null = null;
  for (const f of schema.fields) {
    const v = src[f];
    if (f in schema.rest && same(v, schema.rest[f])) row.push(null);
    else if (v === null) {
      // A null where rest is something else cannot be a nil in the row: it goes at the end.
      row.push(null);
      (extra ??= {})[f] = null;
    } else if (schema.nested?.[f]) row.push(packRow(v as object, schema.nested[f]));
    else row.push(v);
  }
  for (const k of Object.keys(src)) {
    if (!(schema.named ??= new Set(schema.fields)).has(k) && src[k] !== undefined) (extra ??= {})[k] = src[k];
  }
  if (extra) row.push(extra);
  else while (row.length && row[row.length - 1] === null && schema.fields[row.length - 1] in schema.rest) row.pop();
  return row;
}

function unpackRow<T>(row: PackedRow, schema: Schema): T {
  const o: Record<string, unknown> = {};
  const n = schema.fields.length;
  for (let i = 0; i < n; i++) {
    const f = schema.fields[i];
    const v = i < row.length ? row[i] : null;
    if (v === null) o[f] = structuredCopy(schema.rest[f]);
    else o[f] = schema.nested?.[f] ? unpackRow(v as PackedRow, schema.nested[f]) : v;
  }
  const extra = row.length > n ? (row[n] as Record<string, unknown>) : null;
  if (extra) Object.assign(o, extra);
  return o as T;
}

/** A resting value is shared by every row: each unpacked row gets its own copy, so the sim may change it. */
function structuredCopy<T>(v: T): T {
  return v !== null && typeof v === 'object' ? (JSON.parse(JSON.stringify(v)) as T) : v;
}

export function packState(s: SimState): PackedState {
  return {
    ...s,
    players: s.players.map((p) => packRow(p, PLAYER)),
    enemies: s.enemies.map((e) => packRow(e, ENEMY)),
    projectiles: s.projectiles.map((p) => packRow(p, PROJECTILE)),
  };
}

export function unpackState(p: PackedState): SimState {
  return {
    ...p,
    players: p.players.map((r) => unpackRow<PlayerState>(r, PLAYER)),
    enemies: p.enemies.map((r) => unpackRow<EnemyState>(r, ENEMY)),
    projectiles: p.projectiles.map((r) => unpackRow<ProjectileState>(r, PROJECTILE)),
  };
}

/** A message as the room sends it: a snapshot packed, the rest as they are. */
export function toWire(msg: ToPeer): ToPeerWire {
  if (msg.k !== 'snap') return msg;
  const { s, ...rest } = msg;
  return { ...rest, p: packState(s) };
}

/** A message as the browser reads it. */
export function fromWire(msg: ToPeerWire): ToPeer {
  if (msg.k !== 'snap') return msg;
  const { p, ...rest } = msg;
  return { ...rest, s: unpackState(p) };
}
