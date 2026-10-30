import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, removePlayer } from '../sim/coop';
import { restartRun, skipToWave } from '../sim/run';
import { createSimState, stepSim } from '../sim/world';
import golden from './golden.json';
import { SCENARIOS, playScenario, type SimApi } from './scenario';

const api: SimApi = {
  arena,
  buildWorld: buildWorld as SimApi['buildWorld'],
  createSimState: createSimState as SimApi['createSimState'],
  stepSim: stepSim as SimApi['stepSim'],
  addPlayer: addPlayer as SimApi['addPlayer'],
  removePlayer,
  skipToWave: skipToWave as SimApi['skipToWave'],
  restartRun: restartRun as SimApi['restartRun'],
  tickRate: tuning.sim.tickRate,
};

// The hashes were recorded from the combat slice's own code (main 363b726) by `npm run test:parity -- --write`.
// A change to the fight on purpose re-records them; anything else failing here moved the fight away from the slice.
describe("Hearthgate's copy of the slice's fight matches the slice", () => {
  // Hearthgate's downs and its item catalogue (T5) are its own rules; with them off the rest of the
  // fight is the slice's, to the bit.
  const kept = { bleedOut: true, catalogue: true, level4: 0, maxLevel: 50, healthPerLevel: 0, meleeGuard: true, heavies: true, flow: true, swap: false, cancelAfter: 0, keepIframes: true, launch: true };
  beforeAll(() => {
    kept.bleedOut = tuning.coop.bleedOut;
    kept.catalogue = tuning.gear.catalogue;
    kept.level4 = tuning.progression.level4DamageBonus;
    kept.maxLevel = tuning.progression.maxLevel;
    kept.healthPerLevel = tuning.progression.healthPerLevel;
    kept.meleeGuard = tuning.abilities.meleeGuard;
    kept.heavies = tuning.combo.heavies;
    kept.flow = tuning.flow.enabled;
    kept.swap = tuning.combo.swapInFight;
    kept.cancelAfter = tuning.dodge.cancelAfterMs;
    kept.keepIframes = tuning.dodge.keepIframesOnCancel;
    kept.launch = tuning.launch.enabled;
    tuning.coop.bleedOut = false;
    // The slice's roll tail and its i-frames ending with it (D9 shortened one and kept the other).
    tuning.dodge.cancelAfterMs = 240;
    tuning.dodge.keepIframesOnCancel = false;
    // The slice's chain has no heavies (C1).
    tuning.combo.heavies = false;
    // The slice swaps weapons mid-fight (C3 keeps one per outing).
    tuning.combo.swapInFight = true;
    // Nor a Flow meter (C2).
    tuning.flow.enabled = false;
    tuning.gear.catalogue = false;
    // The slice's flat +10% at level 4 and its level cap (T6 moved the bonus into Might's ranks).
    tuning.progression.level4DamageBonus = 0.1;
    tuning.progression.maxLevel = 20;
    // Nor does a level raise health in the slice.
    tuning.progression.healthPerLevel = 0;
    // The slice's Charge and Whirlwind protect nothing (C6).
    tuning.abilities.meleeGuard = false;
    // The slice's dead just fall (K1).
    tuning.launch.enabled = false;
  });
  afterAll(() => {
    tuning.coop.bleedOut = kept.bleedOut;
    tuning.gear.catalogue = kept.catalogue;
    tuning.progression.level4DamageBonus = kept.level4;
    tuning.progression.maxLevel = kept.maxLevel;
    tuning.progression.healthPerLevel = kept.healthPerLevel;
    tuning.abilities.meleeGuard = kept.meleeGuard;
    tuning.combo.heavies = kept.heavies;
    tuning.flow.enabled = kept.flow;
    tuning.combo.swapInFight = kept.swap;
    tuning.dodge.cancelAfterMs = kept.cancelAfter;
    tuning.dodge.keepIframesOnCancel = kept.keepIframes;
    tuning.launch.enabled = kept.launch;
  });

  for (const sc of SCENARIOS) {
    it(sc.name, () => {
      const want = (golden as Record<string, { checkpoints: number[]; all: number }>)[sc.name];
      const got = playScenario(api, sc);
      const first = got.checkpoints.findIndex((h, i) => h !== want.checkpoints[i]);
      expect(first, `first different second: ${first}`).toBe(-1);
      expect(got.all).toBe(want.all);
    }, 60_000);
  }

  it('is deterministic: the same scenario twice gives the same states', () => {
    const sc = { ...SCENARIOS[0], ticks: 1200 };
    expect(playScenario(api, sc).all).toBe(playScenario(api, sc).all);
  });
});
