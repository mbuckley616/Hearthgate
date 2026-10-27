import { readDungeon, type HandDungeon } from '../handmade';
import oldCellar from './old-cellar.json';

/**
 * The hand-built dungeons that ship with the game (T4b): files exported from the editor and
 * committed here, one import each. Keeper Wren offers them in the village beside a generated run.
 */
export const DUNGEONS: HandDungeon[] = [oldCellar].map((d) => readDungeon(d)!);
