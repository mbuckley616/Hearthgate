import { describe, expect, it } from 'vitest';
import { buildWorld } from '../level/arena';
import { floorLevel } from '../level/floor';
import { readToHost } from '../net/validate';
import { depthMult, roomBudget } from '../sim/floorRun';
import { DIFFICULTIES, MAX_FLOORS, STORY, choiceLabel, difficultyMult, maxDifficulty, readPortalChoice } from './portalChoice';
import { floorSpecFor, planChoice } from './runPlan';

describe("Keeper Wren's portal menu (P7)", () => {
  it('opens one more difficulty for each shrine tier, Normal from the start', () => {
    expect(DIFFICULTIES[maxDifficulty(1)].name).toBe('Normal');
    expect(DIFFICULTIES[maxDifficulty(2)].name).toBe('Hard');
    expect(DIFFICULTIES[maxDifficulty(4)].name).toBe('Legendary');
    expect(maxDifficulty(9)).toBe(DIFFICULTIES.length - 1);
  });

  it('takes a story id there is, or a random shape within the bounds', () => {
    expect(readPortalChoice({ kind: 'story', id: STORY[0].id })).toEqual({ kind: 'story', id: STORY[0].id });
    expect(readPortalChoice({ kind: 'story', id: 'atlantis' })).toBeNull();
    expect(readPortalChoice({ kind: 'random', floors: 3, size: 'large', difficulty: 2, modifier: null })).toEqual({ kind: 'random', floors: 3, size: 'large', difficulty: 2, modifier: null });
    expect(readPortalChoice({ kind: 'random', floors: MAX_FLOORS + 1, size: 'large', difficulty: 2, modifier: null })).toBeNull();
    expect(readPortalChoice({ kind: 'random', floors: 3, size: 'huge', difficulty: 2, modifier: null })).toBeNull();
    expect(readPortalChoice({ kind: 'random', floors: 3, size: 'small', difficulty: 9, modifier: null })).toBeNull();
    expect(readToHost({ k: 'portal', choice: { kind: 'random', floors: 1, size: 'small', difficulty: 0, modifier: null } })).not.toBeNull();
    expect(choiceLabel({ kind: 'random', floors: 1, size: 'small', difficulty: 0, modifier: null })).toBe('A small dungeon, 1 floor, Easy');
  });

  it('plans a random run as shaped, and a story run as written, every floor carrying both', () => {
    const random = planChoice([], 7, { kind: 'random', floors: 4, size: 'large', difficulty: 3, modifier: null });
    expect(random.floors).toBe(4);
    const f2 = floorSpecFor(random, 2);
    expect(f2.difficulty).toBe(3);
    expect(f2.pieces).toBeGreaterThan(floorSpecFor(planChoice([], 7, { kind: 'random', floors: 4, size: 'small', difficulty: 3, modifier: null }), 2).pieces);
    const generated = STORY.find((s) => !('hand' in s.run))!;
    const story = planChoice([], 7, { kind: 'story', id: generated.id });
    expect(floorSpecFor(story, 1).story).toBe(generated.id);
    // A story dungeon is the same place every time, whatever seed the server picked.
    expect(floorSpecFor(planChoice([], 99, { kind: 'story', id: generated.id }), 1).seed).toBe(floorSpecFor(story, 1).seed);
  });

  it('a hand-built story dungeon keeps its story, difficulty and modifier on every floor the level is built from', () => {
    const built = STORY.find((s) => 'hand' in s.run)!;
    const plan = planChoice([], 7, { kind: 'story', id: built.id });
    for (let f = 1; f <= plan.floors; f++) {
      const spec = floorLevel(floorSpecFor(plan, f)).dungeon!.def.spec;
      expect(spec.story).toBe(built.id);
      expect(spec.difficulty).toBe(built.run.difficulty);
      expect(spec.modifier).toBe(built.run.modifier);
      expect(spec.seed).toBe(0);
    }
    const cursed = floorLevel({ ...floorSpecFor(plan, 1), difficulty: 3, modifier: 'cursed' }).dungeon!.def.spec;
    expect(cursed.difficulty).toBe(3);
    expect(cursed.modifier).toBe('cursed');
  });

  it('fills rooms and pays more the harder the portal', () => {
    const spec = (difficulty: number) => floorSpecFor(planChoice([], 7, { kind: 'random', floors: 2, size: 'medium', difficulty, modifier: null }), 2);
    const easy = buildWorld(floorLevel(spec(0)));
    const hard = buildWorld(floorLevel(spec(3)));
    expect(depthMult(hard) / depthMult(easy)).toBeCloseTo(difficultyMult(3) / difficultyMult(0), 6);
    const room = easy.level.dungeon!.pieces.find((p) => p.fight)!;
    expect(roomBudget(room, 2, 1)).toBeGreaterThan(0);
  });
});
