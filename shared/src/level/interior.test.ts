import { describe, expect, it } from 'vitest';
import { addPlayer, type Loadout } from '../sim/coop';
import { emptyMods } from '../sim/gear';
import { stepPlayer } from '../sim/player';
import { emptyTalents } from '../sim/talents';
import { idleCommand } from '../sim/types';
import { createSimState } from '../sim/world';
import { buildWorld } from './arena';
import { village } from './village';

const world = buildWorld(village);
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const DT = 1 / 60;

describe("the shrine's inside (interiors, Michael 28 Oct)", () => {
  it('takes a hero walking into the shrine door inside, and back out through the inside door', () => {
    const s = createSimState(village, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    const [into, out] = village.village!.doors;
    p.x = into.x;
    p.z = into.z + 1.5;
    for (let i = 0; i < 90 && p.z > -50; i++) stepPlayer(p, { ...idleCommand(), moveZ: -1, aimX: 0, aimZ: -1 }, DT, world, s);
    expect(Math.hypot(p.x - into.toX, p.z - into.toZ)).toBeLessThan(1);
    // Inside, Keeper Wren is in reach of her table's front.
    const wren = village.village!.villagers.find((n) => n.building === 'shrine')!;
    expect(wren.z).toBeLessThan(-74);
    // Walking back south goes out through the inside door, onto the square before the shrine.
    for (let i = 0; i < 120 && p.z < -50; i++) stepPlayer(p, { ...idleCommand(), moveZ: 1, aimX: 0, aimZ: 1 }, DT, world, s);
    expect(Math.hypot(p.x - out.toX, p.z - out.toZ)).toBeLessThan(1.5);
  });

  it('never lands a hero in a door circle, so nobody bounces back', () => {
    const doors = village.village!.doors;
    for (const d of doors) for (const e of doors) expect(Math.hypot(d.toX - e.x, d.toZ - e.z)).toBeGreaterThan(e.radius);
  });
});
