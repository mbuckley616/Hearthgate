import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { difficultyMult } from '../game/portalChoice';
import { floorLevel, type PieceInfo } from '../level/floor';
import { roomBudget } from './floorRun';
import { composeRoom, rolesIn, roomTier, type Placed, type RoomContext } from './roomMix';

/** A small seeded stream, standing in for the sim's `state.rng`. */
function stream(seed: number): () => number {
  let x = seed * 2654435761 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

const SEEDS = [11, 22, 33, 44, 55];

/** Every fight room of a seed's floor, composed as the floor composes its first group. */
function rooms(seed: number, floor: number, difficulty: number): { room: PieceInfo; budget: number; group: Placed[] }[] {
  const level = floorLevel({ seed, pieces: 30, floor, floors: 3, difficulty });
  const rand = stream(seed);
  return level
    .dungeon!.pieces.filter((p) => p.spots.length > 0 && p.kind !== 'entrance' && p.kind !== 'rest' && p.kind !== 'boss')
    .map((room) => {
      const ctx: RoomContext = { big: room.kind !== 'small' && room.kind !== 'guard', floor, difficulty };
      const budget = Math.max(1, Math.round(roomBudget(room, floor, 1) * tuning.dungeon.firstGroupShare * difficultyMult(difficulty)));
      return { room, budget, group: composeRoom(budget, ctx, rand) };
    });
}

describe('Crypt rooms composed by role (E1h)', () => {
  it('five seeds: every room is a mix, and each specialist comes with its reason', () => {
    for (const seed of SEEDS) {
      for (const { room, budget, group } of rooms(seed, 1, 1)) {
        const roles = rolesIn(group);
        // Never one kind alone: fodder with bows, or a specialist with its pack (a closet's two grunts apart).
        if (budget >= 4) expect(roles.size, `seed ${seed} ${room.kind}: ${group.map((g) => g.kind)}`).toBeGreaterThanOrEqual(2);
        // A Priest only with at least two bodies it can raise.
        if (roles.has('leader')) expect(group.filter((g) => ['grunt', 'archer', 'shieldbearer'].includes(g.kind)).length).toBeGreaterThanOrEqual(2);
        // Never more bows than blades.
        const bows = group.filter((g) => g.kind === 'archer').length;
        expect(bows).toBeLessThanOrEqual(group.length - bows);
        // Every big room has a specialist (on Normal, floor 1, a role apiece).
        if (room.kind !== 'small' && room.kind !== 'guard') expect([...roles].some((r) => r !== 'fodder' && r !== 'archer') || bows >= 2).toBe(true);
      }
    }
  });

  it('the line stands where it should: shields and fodder in front, bows, the Priest and the Wraith behind, Hounds at the far end', () => {
    for (const seed of SEEDS) {
      for (const { group } of rooms(seed, 2, 3)) {
        for (const g of group) {
          if (g.kind === 'archer' || g.kind === 'priest' || g.kind === 'wraith') expect(g.place).toBe('back');
          else if (g.kind === 'hound') expect(g.place).toBe('far');
          else expect(g.place).toBe('front');
        }
      }
    }
  });

  it('a harder room is harder in kind: Nightmare holds more roles and the elite, Normal on floor 1 never the elite', () => {
    const distinct = (floor: number, difficulty: number) => {
      let n = 0;
      let count = 0;
      let elite = 0;
      for (const seed of SEEDS) {
        for (const { group, room } of rooms(seed, floor, difficulty)) {
          if (room.kind === 'small' || room.kind === 'guard') continue;
          n += rolesIn(group).size;
          count++;
          if (group.some((g) => g.kind === 'knight')) elite++;
        }
      }
      return { mean: n / count, elite };
    };
    const normal = distinct(1, 1);
    const nightmare = distinct(1, 3);
    expect(roomTier({ big: true, floor: 1, difficulty: 3 })).toBe(2);
    expect(normal.elite).toBe(0);
    expect(nightmare.elite).toBeGreaterThan(0);
    expect(nightmare.mean).toBeGreaterThan(normal.mean + 1);
  });

  it('spends no more than its budget, and the same stream composes the same room', () => {
    const ctx: RoomContext = { big: true, floor: 2, difficulty: 2 };
    for (let budget = 1; budget <= 30; budget++) {
      const a = composeRoom(budget, ctx, stream(budget));
      const b = composeRoom(budget, ctx, stream(budget));
      expect(a).toEqual(b);
      const cost = { grunt: 1, archer: 2, brute: 4, shieldbearer: 3, hound: 2, priest: 3, knight: 6, wraith: 3 };
      expect(a.reduce((s, g) => s + cost[g.kind], 0)).toBeLessThanOrEqual(budget);
      expect(a.length).toBeGreaterThan(0);
    }
  });
});
