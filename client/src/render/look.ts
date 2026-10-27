import { tuning } from '@hearthgate/shared/config/tuning';
import type { LevelKind } from '@hearthgate/shared/net/protocol';

/**
 * Which mood the scene is lit in: the slice's violet dungeon (tuning.look) or the village's golden
 * afternoon (tuning.villageLook over it, T3). Everything that used to read tuning.look for light,
 * fog, grade or bloom reads activeLook() instead, every frame, so the panel still tunes it live.
 */
let mood: LevelKind = 'arena';

export function setLookMood(kind: LevelKind): void {
  mood = kind;
}

export function lookMood(): LevelKind {
  return mood;
}

type Look = typeof tuning.look & Partial<typeof tuning.villageLook>;

/** tuning.look, with the village's values over it while in the village. */
export function activeLook(): Look {
  return mood === 'village' ? { ...tuning.look, ...tuning.villageLook } : tuning.look;
}
