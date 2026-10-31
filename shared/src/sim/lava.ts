import { tuning } from '../config/tuning';
import type { World } from '../level/arena';
import { lavaAt } from '../level/lava';
import { knockDown } from './combat';
import type { SimState } from './types';

/**
 * Lava (D6): a hero on their feet in a strip burns, a pulse every `lava.tickS` from the tick they step
 * in; one in the air (a hop over it) does not, and stepping out ends it. In stepSim and never in
 * prediction, as a hit is: the browser's hero takes its health from the snapshot. A henchman's brain
 * does not see lava yet, so henchmen are spared rather than walked into it; enemies are the depths' own.
 */
export function stepLava(state: SimState, world: World, dt: number): void {
  const lava = world.level.dungeon?.lava;
  if (!lava?.length) return;
  const t = tuning.lava;
  for (const p of state.players) {
    const burning = !p.henchman && p.mode !== 'down' && p.hp > 0 && p.grounded && !!lavaAt(lava, p.x, p.y, p.z);
    if (!burning) {
      delete p.burn;
      continue;
    }
    if (p.burn !== undefined) {
      p.burn -= dt;
      if (p.burn > 1e-9) continue;
    }
    p.burn = (p.burn ?? 0) + t.tickS;
    const damage = p.maxHp * t.burnFracPerS * t.tickS;
    p.hp = Math.max(0, p.hp - damage);
    state.events.push({ kind: 'heroHurt', playerId: p.id, damage, x: p.x, z: p.z, heavy: false });
    if (p.hp <= 0) knockDown(state, p);
  }
}
