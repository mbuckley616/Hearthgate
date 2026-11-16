import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { bossAttackDone, noteBossHit } from './attention';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, nearestTarget } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { EnemyState, SimState } from './types';
import { createSimState } from './world';

// B2, a boss's attention (docs/bosses.md 1.2; Michael's A on the document, 16 Nov): it fights whoever
// hit it lately, never one hero more than three attacks running while another stands; a taunt holds it.

const world = buildWorld(arena);
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { attention: tuning.bosses.attention };
afterEach(() => {
  tuning.bosses.attention = kept.attention;
});

/** A Warden with a sword hero beside it (p1, 2 m) and a bow hero far off (p2, 12 m). */
function scene(): { s: SimState; w: EnemyState } {
  const s = createSimState(arena, [], world);
  Object.assign(addPlayer(s, world, 'p1', loadout, false), { x: 0, z: 2, mode: 'move' });
  Object.assign(addPlayer(s, world, 'p2', loadout, false), { x: 0, z: 12, mode: 'move' });
  const w = createEnemy(s, world, 'warden', 0, 0, 0);
  return { s, w };
}

/** The target of each of `n` attacks, both heroes hitting it before every one. */
function attacks(s: SimState, w: EnemyState, n: number, hitters = ['p1', 'p2']): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    s.time += 2;
    for (const id of hitters) noteBossHit(s, w, s.players.find((p) => p.id === id)!);
    out.push(nearestTarget(s, w)!.id);
    bossAttackDone(w);
  }
  return out;
}

describe("a boss's attention (B2)", () => {
  it('turns from the hero beside it to the one at range every three attacks while both hit it', () => {
    const { s, w } = scene();
    expect(attacks(s, w, 9)).toEqual(['p1', 'p1', 'p1', 'p2', 'p2', 'p2', 'p1', 'p1', 'p1']);
  });

  it('keeps its target through an attack: it chooses only between them', () => {
    const { s, w } = scene();
    noteBossHit(s, w, s.players[0]);
    expect(nearestTarget(s, w)!.id).toBe('p1');
    // The bow hero hits mid-swing and steps nearer; the swing stays on the sword hero.
    noteBossHit(s, w, s.players[1]);
    s.players[1].z = 1;
    expect(nearestTarget(s, w)!.id).toBe('p1');
  });

  it('goes after a hero at range who hits it while the one beside it does not', () => {
    const { s, w } = scene();
    expect(attacks(s, w, 2, ['p2'])).toEqual(['p2', 'p2']);
  });

  it('stays on the one hero standing however long it runs', () => {
    const { s, w } = scene();
    s.players[1].mode = 'down';
    expect(attacks(s, w, 5)).toEqual(['p1', 'p1', 'p1', 'p1', 'p1']);
  });

  it('is held by a taunt over its attention', () => {
    const { s, w } = scene();
    attacks(s, w, 3);
    w.taunt = { by: 'p1', until: s.time + 10 };
    expect(attacks(s, w, 4)).toEqual(['p1', 'p1', 'p1', 'p1']);
  });

  it('turns on the nearest, as the slice did, with the switch off', () => {
    tuning.bosses.attention = false;
    const { s, w } = scene();
    expect(attacks(s, w, 6)).toEqual(['p1', 'p1', 'p1', 'p1', 'p1', 'p1']);
    expect(w.attn).toBeUndefined();
  });
});
