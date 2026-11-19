import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { killEnemy } from './combat';
import { createEnemy, hornAdds, nearestTarget, stepEnemies } from './enemies';
import { bossOf } from './floorRun';
import { emptyMods } from './gear';
import { ADD_WEAKNESS, attackType, roleOf, telegraphColour, weakTo } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// G1b: Chief Grubnose and his Pig, mounted (docs/bosses.md 2.5, phase 1).

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

function scene(): { s: SimState; p: PlayerState; boss: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, yaw: Math.PI, invulnerable: false, invulnTime: 0, lagGrace: 0, hp: 1e4, maxHp: 1e4 });
  const boss = createEnemy(s, world, 'grubnose', 0, EDGE - 11, 0);
  Object.assign(boss, { x: 0, z: EDGE - 11, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, boss };
}

/** Steps until `done` or `max` ticks, keeping the hero where it stands. */
function until(s: SimState, p: PlayerState, done: () => boolean, max = 600): number {
  const at = { x: p.x, z: p.z };
  for (let i = 0; i < max; i++) {
    if (done()) return i;
    stepEnemies(s, DT, world);
    Object.assign(p, at);
  }
  return -1;
}

const chargeAt = (s: SimState, p: PlayerState, boss: EnemyState) => until(s, p, () => boss.ai === 'charge' || boss.ai === 'recover' || boss.ai === 'stagger');

afterEach(() => {
  tuning.grubnose.enabled = true;
});

describe('Chief Grubnose and his Pig (G1b)', () => {
  it('is a boss that ends the Saltmarsh Warrens, and only with its switch on', () => {
    expect(roleOf('grubnose')).toBe('boss');
    expect(bossOf('saltmarsh')).toBe('grubnose');
    tuning.grubnose.enabled = false;
    expect(bossOf('saltmarsh')).toBe('warden');
  });

  it('the charge is a red line of blunt, the sling a yellow line of pierce', () => {
    expect(telegraphColour({ kind: 'grubnose', attack: 'charge' })).toBe('strike');
    expect(telegraphColour({ kind: 'grubnose', attack: 'sling' })).toBe('projectile');
    expect(attackType({ kind: 'grubnose', attack: 'charge' })).toBe('blunt');
    expect(attackType({ kind: 'grubnose', attack: 'sling' })).toBe('pierce');
  });

  it('winds up the charge for its telegraph, then rushes and throws an unguarded hero', () => {
    const { s, p, boss } = scene();
    stepEnemies(s, DT, world);
    expect(boss.ai).toBe('chargeWindup');
    expect(boss.attack).toBe('charge');
    expect(boss.tele.shape).toBe('line');
    const ticks = until(s, p, () => boss.ai === 'charge');
    expect(ticks * DT * 1000).toBeGreaterThanOrEqual(tuning.grubnose.telegraphMs - 20);
    const hp = p.hp;
    until(s, p, () => boss.ai !== 'charge');
    expect(p.hp).toBeLessThan(hp);
    expect(p.mode).toBe('hurt');
    expect(boss.ai).toBe('recover');
  });

  it('a guard that covers the charge stops the Pig dead: staggered, the hero standing', () => {
    const { s, p, boss } = scene();
    Object.assign(p, { mode: 'guard', guardTime: 2, parryOpen: false });
    stepEnemies(s, DT, world);
    chargeAt(s, p, boss);
    until(s, p, () => boss.ai !== 'charge');
    expect(boss.ai).toBe('stagger');
    expect(p.mode).toBe('guard');
    expect(s.events.some((e) => e.kind === 'block' && !e.broke)).toBe(true);
  });

  it('after a charge it slings from the saddle at the farthest hero, and the shot flies', () => {
    const { s, p, boss } = scene();
    stepEnemies(s, DT, world);
    until(s, p, () => boss.ai === 'recover');
    // The hero thrown, set far off; once its cooldown is out it slings instead of charging.
    Object.assign(p, { x: 0, z: EDGE - 2, kbx: 0, kbz: 0 });
    Object.assign(boss, { x: 0, z: EDGE - 11 });
    until(s, p, () => boss.ai === 'aim');
    expect(boss.attack).toBe('sling');
    expect(boss.tele.shape).toBe('line');
    expect(until(s, p, () => s.projectiles.some((pr) => pr.hostile && pr.owner === `e${boss.id}`))).toBeGreaterThan(0);
    // Then the Pig again: a charge comes next.
    until(s, p, () => boss.ai === 'chargeWindup');
    expect(boss.attack).toBe('charge');
  });

  it('a hero close by is charged, not slung at', () => {
    const { s, p, boss } = scene();
    Object.assign(boss, { attack: 'charge' });
    Object.assign(p, { z: boss.z + tuning.grubnose.slingMinRange - 1.5 });
    stepEnemies(s, DT, world);
    expect(boss.ai).toBe('chargeWindup');
  });
  it('unhorsed at 60% (G2b): it blows its horn, then fights on foot with a red string of edge', () => {
    const { s, p, boss } = scene();
    boss.hp = boss.maxHp * tuning.grubnose.phase2At - 1;
    stepEnemies(s, DT, world);
    expect(boss.ai).toBe('roar');
    expect(s.events.some((e) => e.kind === 'roar' && e.phase === 2)).toBe(true);
    until(s, p, () => boss.ai !== 'roar');
    expect(boss.phase).toBe(2);
    // Close by, on foot: the looted string's wind-up, a strike, then two cuts.
    Object.assign(boss, { x: 0, z: p.z - 1.6, yaw: 0, cooldown: 0 });
    until(s, p, () => boss.ai === 'windup');
    expect(boss.attack).toBe('string');
    expect(telegraphColour(boss)).toBe('strike');
    expect(attackType(boss)).toBe('edge');
    const hp = p.hp;
    s.events.length = 0;
    until(s, p, () => boss.ai === 'recover');
    expect(hp - p.hp).toBeCloseTo(tuning.grubnose.stringDamage * 2, 5);
    expect(s.events.filter((e) => e.kind === 'heroHurt' && e.type === 'edge').length).toBe(2);
    // Never back to the Pig's charge or the sling while it is on foot.
    Object.assign(boss, { z: p.z - 9 });
    until(s, p, () => boss.ai === 'chargeWindup' || boss.ai === 'aim', 300);
    expect(boss.ai).not.toBe('chargeWindup');
    expect(boss.ai).not.toBe('aim');
  });
  it('his horn brings adds by weakness, as many as the heroes: Nests warded, the Crew armoured', () => {
    const { s, p, boss } = scene();
    expect(hornAdds(s)).toEqual(['nestSlinger']);
    boss.hp = boss.maxHp * tuning.grubnose.phase2At - 1;
    stepEnemies(s, DT, world);
    until(s, p, () => boss.ai !== 'roar');
    expect(s.enemies.filter((e) => e !== boss).map((e) => e.kind).sort()).toEqual(['lootPile', 'nestSlinger']);
    expect(ADD_WEAKNESS.nestSlinger).toBe('warded');
    expect(weakTo('nestSlinger')).toBe('bow');
    expect(ADD_WEAKNESS.potlidCrew).toBe('armoured');
    expect(weakTo('potlidCrew')).toBe('staff');
    const two = scene();
    addPlayer(two.s, world, 'p2', loadout, false);
    expect(hornAdds(two.s)).toEqual(['nestSlinger', 'potlidCrew']);
    addPlayer(two.s, world, 'p3', loadout, false);
    expect(hornAdds(two.s)).toEqual(['nestSlinger', 'potlidCrew', 'nestSlinger']);
  });

  it('the Pot-lid Crew rush the mage past a nearer blade', () => {
    const { s, p } = scene();
    const mage = addPlayer(s, world, 'p2', loadout, false);
    Object.assign(mage, { x: 0, z: -10, style: 'staff' });
    Object.assign(p, { style: 'sword' });
    const crew = createEnemy(s, world, 'potlidCrew', 0, EDGE - 5, 0);
    expect(nearestTarget(s, crew)).toBe(mage);
    const slinger = createEnemy(s, world, 'nestSlinger', 0, EDGE - 5, 0);
    expect(nearestTarget(s, slinger)).toBe(p);
    mage.mode = 'down';
    expect(nearestTarget(s, crew)).toBe(p);
  });
  it('his loot pile refills a felled Nest every 10 s while it stands, and falls with him', () => {
    const { s, p, boss } = scene();
    boss.hp = boss.maxHp * tuning.grubnose.phase2At - 1;
    stepEnemies(s, DT, world);
    until(s, p, () => boss.ai !== 'roar');
    const pile = s.enemies.find((e) => e.kind === 'lootPile')!;
    expect(pile).toBeDefined();
    const nests = () => s.enemies.filter((e) => e.kind === 'nestSlinger' && e.ai !== 'dead');
    expect(nests().length).toBe(1);
    killEnemy(s, nests()[0], 0);
    expect(nests().length).toBe(0);
    // Keep the Chief from the fight so only the pile acts.
    boss.hp = boss.maxHp;
    const ticks = until(s, p, () => nests().length > 0, 60 * 12);
    expect(ticks * DT * 1000).toBeLessThanOrEqual(tuning.grubnose.pileRefillMs + 50);
    expect(ticks).toBeGreaterThan(0);
    // Smashed, it pays no more, and spills its coin where it stood (on a floor, as a crate's).
    expect(pile.sack).toBe(tuning.grubnose.pileCoin);
    killEnemy(s, nests()[0], 0);
    killEnemy(s, pile, 0);
    expect(pile.sack).toBeUndefined();
    expect(until(s, p, () => nests().length > 0, 60 * 12)).toBe(-1);
    // A pile still standing falls with him.
    const other = createEnemy(s, world, 'lootPile', 5, 0, 0);
    until(s, p, () => other.ai !== 'spawn');
    killEnemy(s, boss, 0);
    stepEnemies(s, DT, world);
    expect(other.ai).toBe('dead');
  });
});
