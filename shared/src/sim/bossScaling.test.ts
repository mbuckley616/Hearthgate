import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { bossPace, createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { SimState } from './types';
import { createSimState } from './world';

// B1, party scaling for bosses (docs/bosses.md 1.2; Michael's A on the document, 16 Nov): a boss grows
// 0.35 a player rather than 0.6, a henchman counts half a player, and its recoveries run longer against
// one hero alone and shorter while a henchman stands. Every other enemy is as it was.

const world = buildWorld(arena);
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

const kept = { ...tuning.bosses, passive: tuning.debug.passiveEnemies };
afterEach(() => {
  const { passive, ...bosses } = kept;
  Object.assign(tuning.bosses, bosses);
  tuning.debug.passiveEnemies = passive;
});

function party(heroes: number, henchmen: number): SimState {
  const s = createSimState(arena, [], world);
  for (let i = 0; i < heroes; i++) addPlayer(s, world, `p${i + 1}`, loadout, false);
  for (let i = 0; i < henchmen; i++) addPlayer(s, world, `h${i + 1}`, loadout, false).henchman = true;
  return s;
}

const hpOf = (s: SimState, kind: 'warden' | 'king' | 'grunt') => createEnemy(s, world, kind, 0, -6, 0).maxHp;

describe('boss party scaling (B1)', () => {
  it('grows a boss 0.35 a player, a henchman counting half', () => {
    const solo = hpOf(party(1, 0), 'warden');
    expect(hpOf(party(2, 0), 'warden') / solo).toBeCloseTo(1.35, 5);
    expect(hpOf(party(3, 0), 'warden') / solo).toBeCloseTo(1.7, 5);
    expect(hpOf(party(1, 3), 'warden') / solo).toBeCloseTo(1.525, 5);
    expect(hpOf(party(2, 0), 'king') / hpOf(party(1, 0), 'king')).toBeCloseTo(1.35, 5);
  });

  it('leaves every other enemy, and every enemy with the switch off, at 0.6 a player in full', () => {
    expect(hpOf(party(1, 3), 'grunt') / hpOf(party(1, 0), 'grunt')).toBeCloseTo(2.8, 5);
    tuning.bosses.partyScaling = false;
    expect(hpOf(party(2, 0), 'warden') / hpOf(party(1, 0), 'warden')).toBeCloseTo(1.6, 5);
    expect(hpOf(party(1, 3), 'warden') / hpOf(party(1, 0), 'warden')).toBeCloseTo(2.8, 5);
  });

  it('paces a boss slower against one hero, faster beside a henchman, and as before for a duo', () => {
    expect(bossPace(party(1, 0), 'warden')).toBe(tuning.bosses.soloCooldownScale);
    expect(bossPace(party(2, 0), 'warden')).toBe(1);
    expect(bossPace(party(1, 2), 'warden')).toBeCloseTo(1 / tuning.bosses.henchmanPace, 5);
    expect(bossPace(party(1, 0), 'grunt')).toBe(1);
    // A duo with one partner down is one hero standing.
    const duo = party(2, 0);
    duo.players[1].mode = 'down';
    expect(bossPace(duo, 'warden')).toBe(tuning.bosses.soloCooldownScale);
    tuning.bosses.partyScaling = false;
    expect(bossPace(party(1, 0), 'warden')).toBe(1);
  });

  it('holds a solo hero’s Warden in its recovery and its cooldown that much longer', () => {
    tuning.debug.passiveEnemies = false;
    const recovering = (solo: boolean): number => {
      const s = party(solo ? 1 : 2, 0);
      s.players.forEach((p, i) => Object.assign(p, { x: i * 30 + 20, z: 20, hp: 1e6, maxHp: 1e6 }));
      const w = createEnemy(s, world, 'warden', 0, -6, 0);
      Object.assign(w, { ai: 'recover', aiTime: 0, recoverTime: 0.5, cooldown: 0 });
      let ticks = 0;
      while (w.ai === 'recover' && ticks < 600) {
        stepEnemies(s, 1 / 60, world);
        ticks++;
      }
      return ticks;
    };
    const duo = recovering(false);
    expect(duo).toBeGreaterThan(25);
    // To a tick either way of the 0.5 s.
    expect(Math.abs(recovering(true) / duo - tuning.bosses.soloCooldownScale)).toBeLessThan(0.1);
  });
});
