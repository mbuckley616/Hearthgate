import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { buildWorld } from '../level/arena';
import { floorLevel, insidePiece } from '../level/floor';
import { SPIKE_SIZE, spikeClock, spikesFor } from '../level/traps';
import { createEnemy } from './enemies';
import { spikeStrikeAt, stepTraps } from './traps';
import { createSimState } from './world';

// G5, Michael's D (4 Nov): traps first. Spikes strike on a cycle after an orange warning and hurt
// heroes and enemies alike; a hero in the air clears them.

const kept = { ...tuning.traps };
afterEach(() => Object.assign(tuning.traps, kept));

/** The first of seeds 1.. whose floor has spikes in a fight room. */
function spikedFloor() {
  for (let seed = 1; seed < 200; seed++) {
    const level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
    const layout = level.dungeon!;
    const tile = layout.spikes.find((t) => layout.pieces[t.piece].fight);
    if (!tile) continue;
    const world = buildWorld(level);
    const state = createSimState(level, ['p1'], world);
    return { level, layout, world, state, tile };
  }
  throw new Error('no spiked floor in 200 seeds');
}

const DT = 1 / 60;
/** Step the traps alone from just before the tile's strike to just after it. */
function throughStrike(f: ReturnType<typeof spikedFloor>, before = () => {}) {
  const cycle = tuning.traps.spikeCycleS;
  // Sim time at which this tile's clock reads 0.
  const zero = cycle * 10 - f.tile.phase * cycle;
  f.state.time = zero + spikeStrikeAt() - 0.1;
  for (let i = 0; i < 12; i++) {
    before();
    stepTraps(f.state, f.world, DT);
    f.state.time += DT;
  }
}

describe('spikes (G5)', () => {
  it('lies in fight rooms and long halls, inside the walls, clear of doorways and spawn spots, and the same every time', () => {
    let floors = 0;
    let tiles = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const layout = floorLevel({ seed, pieces: 24, floor: 2, floors: 3 }).dungeon!;
      if (layout.spikes.length) floors++;
      tiles += layout.spikes.length;
      for (const t of layout.spikes) {
        const p = layout.pieces[t.piece];
        expect(p.fight || p.kind === 'hallLong').toBe(true);
        expect(p.kind).not.toBe('boss');
        expect(p.kind).not.toBe('rest');
        expect(insidePiece(p, t.x, t.z)).toBe(true);
        expect(t.y).toBe(p.y);
        if (p.fight) for (const d of p.doors.filter((dd) => dd.open)) expect(Math.hypot(d.x - t.x, d.z - t.z)).toBeGreaterThan(SPIKE_SIZE);
        for (const sp of p.spots) expect(Math.abs(sp.x - t.x) > SPIKE_SIZE / 2 || Math.abs(sp.z - t.z) > SPIKE_SIZE / 2).toBe(true);
        expect(layout.lava.some((l) => l.piece === t.piece)).toBe(false);
      }
      const again = floorLevel({ seed, pieces: 24, floor: 2, floors: 3 }).dungeon!;
      expect(again.spikes).toEqual(layout.spikes);
    }
    expect(floors).toBeGreaterThan(15);
    expect(tiles).toBeGreaterThan(30);
  });

  it('never on a hand-built floor', () => {
    const level = floorLevel({ seed: 3, pieces: 24, floor: 1, floors: 3 });
    const def = level.dungeon!.def;
    expect(spikesFor({ ...def, spec: { ...def.spec, hand: { placements: [] } as never } }, level.dungeon!.pieces, [])).toEqual([]);
  });

  it('strikes a hero on the tile once, after the warning and the lag grace', () => {
    const f = spikedFloor();
    const p = f.state.players[0];
    Object.assign(p, { x: f.tile.x, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move', invulnerable: false, invulnTime: 0 });
    let struckAt = -1;
    throughStrike(f, () => {
      if (struckAt < 0 && p.hp < p.maxHp) struckAt = f.state.time;
    });
    expect(p.hp).toBeCloseTo(p.maxHp * (1 - tuning.traps.spikeHeroFrac), 5);
    // It landed on the tick the clock passed the warning plus the grace.
    expect(spikeClock(f.tile, struckAt, tuning.traps.spikeCycleS)).toBeGreaterThanOrEqual(spikeStrikeAt() - DT - 1e-6);
    expect(spikeStrikeAt()).toBeCloseTo(tuning.traps.spikeWarnS + tuning.coop.lagGraceMs / 1000, 9);
  });

  it('misses a hero off the tile and one high in the air, who is told they cleared it', () => {
    const f = spikedFloor();
    const p = f.state.players[0];
    Object.assign(p, { x: f.tile.x + SPIKE_SIZE, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move' });
    throughStrike(f);
    expect(p.hp).toBe(p.maxHp);
    const events: string[] = [];
    Object.assign(p, { x: f.tile.x, z: f.tile.z, y: f.tile.y + tuning.jump.clearHeight + 0.2, grounded: false });
    throughStrike(f, () => events.push(...f.state.events.map((e) => e.kind)));
    // stepTraps pushes onto the events of the step; collect what is there after.
    events.push(...f.state.events.map((e) => e.kind));
    expect(p.hp).toBe(p.maxHp);
    expect(events).toContain('cleared');
  });

  it('hurts an enemy on the tile too, and nothing with the switch off', () => {
    const f = spikedFloor();
    const e = createEnemy(f.state, f.world, 'grunt', f.tile.x, f.tile.z, 0);
    e.ai = 'chase';
    const full = e.hp;
    throughStrike(f);
    expect(e.hp).toBeCloseTo(full - tuning.traps.spikeEnemyDamage, 5);
    tuning.traps.enabled = false;
    const p = f.state.players[0];
    Object.assign(p, { x: f.tile.x, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move' });
    throughStrike(f);
    expect(p.hp).toBe(p.maxHp);
  });
});
