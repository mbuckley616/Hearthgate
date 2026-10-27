import { tuning, tuningRanges } from './tuning';

/**
 * Debug-panel edits through the server. The fight runs on the server, so a number the sim reads
 * must change there, or prediction steps different numbers from the server and every input is a
 * correction. Values only this browser reads (the camera, the look, sound, the player's own
 * settings, the fake latency) stay local, as they were in the slice.
 */
const LOCAL_SECTIONS = new Set(['sim', 'camera', 'look', 'villageLook', 'audio', 'lockOn', 'heroAnim', 'input']);
const LOCAL_PATHS = new Set(['debug.showColliders', 'debug.showHitboxes', 'coop.fakeLatencyMs', 'hitFeel.sfxVolume', 'hitFeel.screenShake']);

type Sections = Record<string, Record<string, unknown>>;

/** Whether an edit to this path goes to the server (and comes back to everyone). */
export function isServerTuning(path: string): boolean {
  const [section] = path.split('.');
  return !LOCAL_SECTIONS.has(section) && !LOCAL_PATHS.has(path);
}

/** Every edit applied in this process (path -> value), sent whole to a joining player. */
const applied: Record<string, number | boolean> = {};

/**
 * Apply one edit if it names a server tuning value of the same type and, for a number with a
 * slider range, lies inside it. Returns whether it applied.
 */
export function applyTuningEdit(path: string, value: number | boolean): boolean {
  if (!isServerTuning(path)) return false;
  const parts = path.split('.');
  if (parts.length !== 2) return false;
  const section = (tuning as unknown as Sections)[parts[0]];
  if (!section || !Object.prototype.hasOwnProperty.call(section, parts[1])) return false;
  const current = section[parts[1]];
  if (typeof current !== typeof value) return false;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    const range = tuningRanges[path];
    if (range && (value < range[0] || value > range[1])) return false;
  }
  section[parts[1]] = value;
  applied[path] = value;
  return true;
}

/** The edits applied so far. */
export function tuningEdits(): Record<string, number | boolean> {
  return { ...applied };
}

/** Write the server's edits into this process's tuning (the client, on a 'tuning' message). */
export function applyServerEdits(edits: Record<string, number | boolean>): void {
  for (const [path, value] of Object.entries(edits)) {
    const [s, k] = path.split('.');
    const section = (tuning as unknown as Sections)[s];
    if (section && typeof section[k] === typeof value) section[k] = value;
  }
}
