/**
 * The combat slice's tuning surface (Michael, 2026-10-26, the combat port). Every feel value
 * the port has brought across lives here, with a slider range in `tuningRanges` so it shows in
 * the debug panel (backtick). Values are the slice's, as Michael tuned them there; each section
 * arrives with the system that reads it, and `sim.ts`'s old constants leave as their systems do.
 *
 * The object is live: the panel edits it. The server's copy is the truth, and an edit goes to
 * the server, which applies it and sends it to every client, so prediction and the server
 * always step with the same numbers (`applyTuning`). Nothing else writes it.
 *
 * Units: metres, seconds (ms where the name says so), degrees for angles.
 */
export const tuning = {
  movement: {
    walkSpeed: 2.0,
    runSpeed: 5.5,
    /** Hold Shift, or click the left stick. */
    sprintSpeed: 8.0,
    /** Stick tilt (0..1) above which the hero runs instead of walks. Keys are always a run. */
    runThreshold: 0.6,
    acceleration: 40,
    deceleration: 30,
    /** How fast the hero turns to face the move direction (with faceCamera off). */
    turnRateDeg: 900,
    /**
     * Strafe movement: the hero always faces where the camera looks; S backpedals and A/D
     * sidestep instead of turning (Michael's call in the slice). Off = turn to run.
     */
    faceCamera: true,
    /** How fast the body follows the camera's facing. */
    faceTurnRateDeg: 1080,
    /** Speed multipliers relative to running forward. */
    strafeSpeedFrac: 0.9,
    backpedalSpeedFrac: 0.72
  },

  dodge: {
    durationMs: 420,
    distance: 4.0,
    /** 0 = linear, higher = more front-loaded burst that eases out. */
    easeOutPower: 2.0,
    /** Untouchable from the start of the roll for this long. */
    iframesMs: 300,
    charges: 2,
    chargeRechargeMs: 1200,
    /** Min time between dodges even with charges left. */
    minGapMs: 80,
    /** Michael's call in the slice: a dodge interrupts an attack at any point. */
    cancelsAttacks: true,
    /** Dodge with no direction held: a hop backward, this fraction of the roll's distance. */
    backstepDistanceFrac: 0.7,
    /**
     * From this point the roll's slow tail can be cut short: moving, attacking, an ability,
     * guard, jump or another dodge ends it at once (Michael: no dodge recovery).
     */
    cancelAfterMs: 240
  },

  jump: {
    /** Apex height of a jump. */
    height: 1.0,
    gravity: 24,
    /** Fraction of ground acceleration available in the air. */
    airControl: 0.45
  },

  input: {
    stickDeadzone: 0.18,
    /** Exponent on look-stick magnitude; >1 gives finer control near centre. */
    lookStickCurve: 2.0
  }
};

export type Tuning = typeof tuning;

/** The values the game shipped with, for the panel's reset and for working out what was changed. */
export const tuningDefaults: Tuning = structuredClone(tuning);

/** Debug panel slider ranges: [min, max, step] per dotted path. A path with no range is not tunable. */
export const tuningRanges: Record<string, [number, number, number]> = {
  "movement.walkSpeed": [0.5, 5, 0.1],
  "movement.runSpeed": [2, 12, 0.1],
  "movement.sprintSpeed": [2, 16, 0.1],
  "movement.runThreshold": [0.1, 1, 0.05],
  "movement.acceleration": [5, 120, 1],
  "movement.deceleration": [5, 120, 1],
  "movement.turnRateDeg": [90, 2000, 10],
  "movement.faceTurnRateDeg": [90, 3000, 10],
  "movement.strafeSpeedFrac": [0.2, 1, 0.01],
  "movement.backpedalSpeedFrac": [0.2, 1, 0.01],

  "dodge.durationMs": [150, 1000, 10],
  "dodge.distance": [1, 10, 0.1],
  "dodge.easeOutPower": [0, 5, 0.1],
  "dodge.iframesMs": [0, 1000, 10],
  "dodge.charges": [1, 5, 1],
  "dodge.chargeRechargeMs": [100, 5000, 50],
  "dodge.minGapMs": [0, 500, 10],
  "dodge.backstepDistanceFrac": [0.1, 1.5, 0.05],
  "dodge.cancelAfterMs": [0, 1000, 10],

  "jump.height": [0.2, 3, 0.05],
  "jump.gravity": [5, 60, 0.5],
  "jump.airControl": [0, 1, 0.05],

  "input.stickDeadzone": [0, 0.5, 0.01],
  "input.lookStickCurve": [1, 4, 0.1]
};

/** A tuning path and its new value, as the panel sends it and the server rebroadcasts it. */
export type TuningEdit = { path: string; value: number | boolean };

/** The section object and key a dotted path names, or null if it is not one. */
function slotOf(path: string): { section: Record<string, unknown>; key: string } | null {
  const parts = path.split(".");
  if (parts.length !== 2) return null;
  const section = (tuning as unknown as Record<string, Record<string, unknown>>)[parts[0]];
  if (!section || !Object.prototype.hasOwnProperty.call(section, parts[1])) return null;
  return { section, key: parts[1] };
}

/**
 * Apply one edit if it names a tunable value of the right kind and in range. Returns whether it
 * applied. The server runs this on what a client sends, so it trusts nothing: a number must have
 * a range and lie inside it, a boolean must replace a boolean.
 */
export function applyTuning(edit: unknown): boolean {
  if (typeof edit !== "object" || edit === null) return false;
  const { path, value } = edit as Partial<TuningEdit>;
  if (typeof path !== "string") return false;
  const slot = slotOf(path);
  if (!slot) return false;
  const current = slot.section[slot.key];
  if (typeof current === "boolean") {
    if (typeof value !== "boolean") return false;
  } else {
    const range = tuningRanges[path];
    if (!range || typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) return false;
  }
  slot.section[slot.key] = value;
  return true;
}

/** Every value that differs from the defaults, for a client joining after edits were made. */
export function tuningEdits(): TuningEdit[] {
  const out: TuningEdit[] = [];
  const cur = tuning as unknown as Record<string, Record<string, unknown>>;
  const def = tuningDefaults as unknown as Record<string, Record<string, unknown>>;
  for (const s of Object.keys(cur)) {
    for (const k of Object.keys(cur[s])) {
      const v = cur[s][k];
      if ((typeof v === "number" || typeof v === "boolean") && v !== def[s][k]) out.push({ path: `${s}.${k}`, value: v });
    }
  }
  return out;
}

/** Put every value back to its default (tests, and the panel's reset). */
export function resetTuning(): void {
  const cur = tuning as unknown as Record<string, Record<string, unknown>>;
  const def = tuningDefaults as unknown as Record<string, Record<string, unknown>>;
  for (const s of Object.keys(cur)) for (const k of Object.keys(cur[s])) cur[s][k] = def[s][k];
}
