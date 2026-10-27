import { describe, expect, it } from 'vitest';
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
