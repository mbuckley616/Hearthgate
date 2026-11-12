import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { emptyMods, xpForLevel } from './gear';
import { countPayoff } from './mastery';
import { restartRun } from './run';
import { emptyTalents } from './talents';
import { createSimState } from './world';

// An arena restart (F after a run is won or lost) rebuilds each hero but keeps who they are. The browser
// sends no loadout after it, so anything dropped here was gone for the rest of the session (critic, 12 Nov).

const world = buildWorld(arena);
const kept = tuning.mastery.enabled;
afterEach(() => {
  tuning.mastery.enabled = kept;
});

const loadout: Loadout = {
  name: 'p1',
  xp: { sword: xpForLevel(30), bow: xpForLevel(30), staff: xpForLevel(30) },
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
  look: ['elm-staff'],
  spec: { sword: 'spellblade' },
  elements: { sword: 'fire' },
  tree: { sword: ['lingering-flame'] },
  mastery: { shatter: 299 },
  champion: { xp: 0, ranks: {} },
  potions: 2,
};

describe('restartRun', () => {
  it('keeps specialization, element, tree, mastery, champion, look and belt', () => {
    const s = createSimState(arena, [], world);
    addPlayer(s, world, 'p1', loadout, false);
    s.players[0].hp = 3;
    restartRun(s, world);
    const p = s.players[0];
    expect(p.spec).toEqual({ sword: 'spellblade' });
    expect(p.elements).toEqual({ sword: 'fire' });
    expect(p.tree).toEqual({ sword: ['lingering-flame'] });
    expect(p.look).toEqual(['elm-staff']);
    expect(p.champion).toEqual({ xp: 0, ranks: {} });
    expect(p.potions).toBe(2);
    expect(p.hp).toBe(p.maxHp);
  });

  it('continues the mastery count rather than starting a fresh one', () => {
    tuning.mastery.enabled = true;
    const s = createSimState(arena, [], world);
    addPlayer(s, world, 'p1', loadout, false);
    restartRun(s, world);
    countPayoff(s, s.players[0], 'shatter');
    expect(s.players[0].mastery).toEqual({ shatter: 300 });
  });

  it('adds nothing to a slice hero (the parity test’s)', () => {
    const s = createSimState(arena, [], world);
    addPlayer(s, world, 'p1', { name: 'p1', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 }, false);
    restartRun(s, world);
    const p = s.players[0];
    for (const k of ['spec', 'elements', 'tree', 'mastery', 'champion', 'look', 'potions', 'bagRoom', 'henchman', 'brain'] as const) expect(p[k]).toBeUndefined();
  });
});
