import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { bankHenchmen, emptyVillage, henchmanCap, readVillageSave, villageView } from '../game/villageSave';
import { arena, buildWorld } from '../level/arena';
import { PROTOCOL_VERSION } from '../net/protocol';
import { grantXp, styleDamageBonus } from './combat';
import { emptyMods, levelFor, xpForLevel } from './gear';
import { henchmanCard, readHenchmanCards } from './henchman';
import { emptyTalents } from './talents';

const world = buildWorld(arena);
const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

function party() {
  const host = new HostSession(world, () => {}, true);
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  return { host, me: host.sim.players[0] };
}

describe('henchmen who grow (P12; Michael, 29 Oct)', () => {
  it('the Tavern caps their level: 12 a tier, the top tier to the last level', () => {
    expect([1, 2, 3, 4].map(henchmanCap)).toEqual([12, 24, 36, tuning.progression.maxLevel]);
  });

  it('the village save keeps their XP by kit, the most each has banked, and the server reads it back', () => {
    const save = emptyVillage('v1');
    expect(bankHenchmen(save, [{ style: 'sword', xp: 500 }, { style: 'bow', xp: 120 }])).toBe(true);
    expect(bankHenchmen(save, [{ style: 'sword', xp: 300 }])).toBe(false);
    expect(save.hench).toEqual({ sword: 500, bow: 120 });
    const back = readVillageSave(JSON.parse(JSON.stringify(save)));
    expect(back?.hench).toEqual({ sword: 500, bow: 120 });
    expect(villageView(save).hench).toEqual({ sword: 500, bow: 120 });
    expect(readVillageSave({ ...save, hench: { axe: 5 } })).toBeNull();
    expect(readVillageSave({ ...save, hench: { sword: -1 } })).toBeNull();
    expect(readVillageSave({ ...emptyVillage('v2') })?.hench).toBeUndefined();
  });

  it('earns no XP past the cap, while a player earns on', () => {
    const { host, me } = party();
    const h = host.addHenchman(me, 'sword', { xp: 0, cap: 3 })!;
    grantXp(host.sim, h, 'sword', xpForLevel(10));
    expect(levelFor(h.xp.sword)).toBe(3);
    grantXp(host.sim, me, 'sword', xpForLevel(10));
    expect(levelFor(me.xp.sword)).toBe(10);
  });

  it('in the village a hire is set to what it banked, under the cap: a wipe loses what a run earned since', () => {
    const { host, me } = party();
    const h = host.addHenchman(me, 'bow', { xp: xpForLevel(30) })!;
    host.settleHenchmen(henchmanCap(2), { bow: xpForLevel(8) }, false);
    expect(levelFor(h.xp.bow)).toBe(8);
    expect(h.brain?.cap).toBe(24);
    host.settleHenchmen(henchmanCap(1), { bow: xpForLevel(20) }, true);
    expect(levelFor(h.xp.bow)).toBe(12);
    expect(h.brain?.quick).toBe(true);
    // The cap travels with the henchman through a ring.
    const card = readHenchmanCards([JSON.parse(JSON.stringify(henchmanCard(h)))])[0];
    expect(card.cap).toBe(12);
  });

  it('a level is its build: damagePerLevel more a level, and health as any hero', () => {
    const { host, me } = party();
    const low = host.addHenchman(me, 'sword', { xp: 0 })!;
    const high = host.addHenchman(me, 'bow', { xp: xpForLevel(11) })!;
    expect(styleDamageBonus(low, 'sword')).toBeCloseTo(0);
    expect(styleDamageBonus(high, 'bow')).toBeCloseTo(10 * tuning.hirelings.damagePerLevel);
    expect(high.maxHp).toBe(100 + 10 * tuning.progression.healthPerLevel);
    // A player's level is talent points, not this.
    me.xp.sword = xpForLevel(11);
    expect(styleDamageBonus(me, 'sword')).toBeCloseTo(0);
  });
});
