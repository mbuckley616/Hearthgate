import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { buildWorld } from '../level/arena';
import { doorBuilding, village } from '../level/village';
import { addPlayer, type Loadout } from '../sim/coop';
import { emptyMods } from '../sim/gear';
import { stepDoors } from '../sim/player';
import { emptyTalents } from '../sim/talents';
import { idleCommand } from '../sim/types';
import { createSimState } from '../sim/world';
import { applyUpgrade, emptyVillage, henchmanCap, plotsOf, pocketSpaces, readVillageSave, stashSpaces, storeStock, tavernHenchmen, tierGives, upgradeCost, upgradeProblem, villageView } from './villageSave';

/** The village starts with only the portal (Michael, 31 Oct, A): empty plots for the other three. */

const kept = tuning.village.startWithPlots;
afterEach(() => {
  tuning.village.startWithPlots = kept;
});

describe('empty plots', () => {
  it('a new village is the shrine and three plots, with the switch on', () => {
    tuning.village.startWithPlots = true;
    const v = emptyVillage('abc');
    expect(v.tiers).toEqual({ shrine: 1, store: 0, storehouse: 0, tavern: 0 });
    expect(plotsOf(v.tiers)).toEqual(['store', 'storehouse', 'tavern']);
    tuning.village.startWithPlots = false;
    expect(plotsOf(emptyVillage('abc').tiers)).toEqual([]);
  });

  it('a save may hold plots, but never a plot for a shrine; an old save keeps its buildings', () => {
    expect(readVillageSave({ id: 'a', lumber: 0, stone: 0, tiers: { shrine: 1, store: 0, storehouse: 0, tavern: 2 } })?.tiers.store).toBe(0);
    expect(readVillageSave({ id: 'a', lumber: 0, stone: 0, tiers: { shrine: 0 } })).toBeNull();
    expect(readVillageSave({ id: 'a', lumber: 0, stone: 0, tiers: {} })?.tiers).toEqual({ shrine: 1, store: 1, storehouse: 1, tavern: 1 });
  });

  it('a plot gives nothing until its first build, which costs a little', () => {
    expect([storeStock(0), stashSpaces(0), tavernHenchmen(0), henchmanCap(0)]).toEqual([0, 0, 0, 0]);
    expect(pocketSpaces(0)).toBe(pocketSpaces(1));
    expect(tierGives('tavern', 0)).toMatch(/empty plot/);
    const first = upgradeCost(1);
    expect(first).toEqual({ lumber: tuning.village.plotLumber, stone: tuning.village.plotStone, coin: tuning.village.plotCoin });
    expect(first.lumber).toBeLessThan(upgradeCost(2).lumber);
    tuning.village.startWithPlots = true;
    const save = emptyVillage('abc');
    expect(upgradeProblem(villageView(save), 'store', 0)).toMatch(/lumber/);
    save.lumber = first.lumber;
    save.stone = first.stone;
    expect(upgradeProblem(villageView(save), 'store', first.coin)).toBeNull();
    applyUpgrade(save, 'store');
    expect(save.tiers.store).toBe(1);
    expect([save.lumber, save.stone]).toEqual([0, 0]);
    expect(plotsOf(save.tiers)).toEqual(['storehouse', 'tavern']);
  });

  it("a plot's front door goes nowhere; a built one takes a press", () => {
    const world = buildWorld(village);
    const v = village.village!;
    const front = v.doors.find((d) => doorBuilding(v, d) === 'store')!;
    expect(v.doors.filter((d) => doorBuilding(v, d) !== null)).toHaveLength(4);
    const s = createSimState(village, [], world);
    const p = addPlayer(s, world, 'p1', { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 } satisfies Loadout, false);
    s.plots = ['store'];
    p.x = front.x;
    p.z = front.z;
    stepDoors(s, world, { p1: { ...idleCommand(), interact: true } });
    expect([p.x, p.z]).toEqual([front.x, front.z]);
    delete s.plots;
    stepDoors(s, world, { p1: { ...idleCommand(), interact: true } });
    expect(Math.hypot(p.x - front.toX, p.z - front.toZ)).toBeLessThan(0.01);
  });
});
