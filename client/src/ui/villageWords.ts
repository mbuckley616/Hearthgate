import type { BuildingId } from '@hearthgate/shared/game/villageSave';

/** The buildings' names as villagers and signs say them. */
export const BUILDING_NAMES: Record<BuildingId, string> = { shrine: 'Portal Shrine', store: 'General Store', storehouse: 'Storehouse', tavern: 'Tavern' };

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** A tier as the signs write it. */
export function roman(n: number): string {
  return ROMAN[n] ?? String(n);
}

export function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
