import { DUNGEONS } from '@hearthgate/shared/level/dungeons';
import { checkDungeon, readDungeon, type HandDungeon } from '@hearthgate/shared/level/handmade';

/**
 * Hand-built dungeons kept in this browser (T4b; decisions.md 27 Oct: the browser, plus an exported
 * file committed to the repo for everyone). Read by the editor and by the game, which offers them at
 * Keeper Wren beside the ones that ship (`shared/src/level/dungeons/`).
 */
const KEY = 'hearthgate.dungeons';

export function savedDungeons(): HandDungeon[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.map(readDungeon).filter((d): d is HandDungeon => d !== null) : [];
  } catch {
    return [];
  }
}

/** Save under its name, replacing one of the same name. */
export function saveDungeon(d: HandDungeon): void {
  const all = savedDungeons().filter((o) => o.name !== d.name);
  localStorage.setItem(KEY, JSON.stringify([...all, d]));
}

export function deleteDungeon(name: string): void {
  localStorage.setItem(KEY, JSON.stringify(savedDungeons().filter((o) => o.name !== name)));
}

/** Every dungeon this browser can play: the ones that ship, then its own playable ones (a saved one shadows a shipped one of the same name). */
export function playableDungeons(): HandDungeon[] {
  const mine = savedDungeons().filter((d) => checkDungeon(d).def);
  return [...DUNGEONS.filter((d) => !mine.some((m) => m.name === d.name)), ...mine];
}

export function findDungeon(name: string): HandDungeon | null {
  return playableDungeons().find((d) => d.name === name) ?? null;
}
