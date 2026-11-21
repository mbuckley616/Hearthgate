import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { floorLevel } from '../level/floor';
import { addPlayer, type Loadout } from './coop';
import { killEnemy } from './combat';
import { createEnemy, hornAdds, nearestTarget, stepEnemies } from './enemies';
import { bossOf } from './floorRun';
import { emptyMods } from './gear';
import { ADD_WEAKNESS, GOBLINS, attackType, roleOf, roomKindIn, telegraphColour, weakTo } from './roles';
import { STORY, readPortalChoice } from '../game/portalChoice';
import { DUNGEON_TYPES } from '../level/dungeonTypes';
import { floorSpecFor, planChoice } from '../game/runPlan';
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
  it('cornered at a wall by a hero inside its charge minimum, it charges point-blank (critic, 19 Nov)', () => {
    const { s, p, boss } = scene();
    // The Pig's back to the wall, the hero 2 m off and staying there, swinging.
    Object.assign(boss, { x: 0, z: EDGE - 1.2, yaw: Math.PI });
    Object.assign(p, { x: 0, z: EDGE - 3.2 });
    const ticks = until(s, p, () => boss.ai === 'chargeWindup', 600);
    expect(ticks).toBeGreaterThan(0);
    expect(ticks * DT * 1000).toBeGreaterThanOrEqual(tuning.grubnose.cornerMs - 20);
    expect(ticks * DT * 1000).toBeLessThan(tuning.grubnose.cornerMs + 500);
    expect(boss.attack).toBe('charge');
    const hp = p.hp;
    until(s, p, () => boss.ai !== 'chargeWindup' && boss.ai !== 'charge');
    expect(p.hp).toBeLessThan(hp);
  });

  it('cornered past a brazier, with the hero in sight, it still charges (Session 277)', () => {
    // Saltmarsh's boss hall, its north-west corner: the hero pinned between the walls and a brazier at
    // (140.6, 27.4), and the Pig 1.3 m off. The way to them bends round the brazier, which once counted
    // as being routed elsewhere and held him in `chase` for six minutes on the bench (seeds 2 and 4).
    const plan = planChoice([], 1, { kind: 'story', id: 'saltmarsh' });
    const level = floorLevel(floorSpecFor(plan, plan.floors));
    const w = buildWorld(level);
    const hall = level.dungeon!.pieces[level.dungeon!.def.exit];
    const s = createSimState(level, [], w);
    const p = addPlayer(s, w, 'p1', loadout, false);
    Object.assign(p, { x: 138.9, z: 27.9, y: hall.y, invulnerable: false, invulnTime: 0, lagGrace: 0, hp: 1e4, maxHp: 1e4 });
    const boss = createEnemy(s, w, 'grubnose', 139.4, 26.7, 0);
    Object.assign(boss, { x: 139.4, z: 26.7, y: hall.y, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0, phase: 3 });
    const at = { x: p.x, z: p.z };
    let ticks = -1;
    for (let i = 0; i < 600 && ticks < 0; i++) {
      stepEnemies(s, DT, w);
      Object.assign(p, at);
      if (boss.ai === 'chargeWindup') ticks = i;
    }
    expect(ticks).toBeGreaterThan(0);
    expect(ticks * DT * 1000).toBeLessThan(tuning.grubnose.cornerMs + 500);
    expect(boss.attack).toBe('rush1');
  });

  it('remounted and cornered, the point-blank charge opens a run of three', () => {
    const { s, p, boss } = scene();
    Object.assign(boss, { x: 0, z: EDGE - 1.2, yaw: Math.PI, phase: 3 });
    Object.assign(p, { x: 0, z: EDGE - 3.2 });
    expect(until(s, p, () => boss.ai === 'chargeWindup', 600)).toBeGreaterThan(0);
    expect(boss.attack).toBe('rush1');
  });

  it('unhorsed at 60% (G2b): it blows its horn, then fights on foot with a red string of edge', () => {
    const { s, p, boss } = scene();
    boss.hp = boss.maxHp * tuning.grubnose.phase2At - 1;
    stepEnemies(s, DT, world);
    expect(boss.ai).toBe('roar');
    expect(s.events.find((e) => e.kind === 'roar')).toEqual({ kind: 'roar', enemyId: boss.id, phase: 2, chief: true });
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
    const mage = addPlayer(two.s, world, 'p2', loadout, false);
    mage.style = 'staff';
    expect(hornAdds(two.s)).toEqual(['nestSlinger', 'potlidCrew']);
    addPlayer(two.s, world, 'p3', loadout, false);
    expect(hornAdds(two.s)).toEqual(['nestSlinger', 'potlidCrew', 'nestSlinger']);
  });

  it('with no staff hero the horn raises a second Nest in the Crew\'s place', () => {
    const { s, p } = scene();
    p.style = 'sword';
    const archer = addPlayer(s, world, 'p2', loadout, false);
    archer.style = 'bow';
    expect(hornAdds(s)).toEqual(['nestSlinger', 'nestSlinger']);
    addPlayer(s, world, 'p3', loadout, false).style = 'sword';
    expect(hornAdds(s)).toEqual(['nestSlinger', 'nestSlinger', 'nestSlinger']);
    // A staff henchman is not a staff hero.
    const hench = addPlayer(s, world, 'h1', loadout, false);
    Object.assign(hench, { style: 'staff', henchman: true });
    expect(hornAdds(s)).toEqual(['nestSlinger', 'nestSlinger', 'nestSlinger']);
    tuning.grubnose.crewNeedsStaff = false;
    try {
      expect(hornAdds(s)).toEqual(['nestSlinger', 'potlidCrew', 'nestSlinger']);
    } finally {
      tuning.grubnose.crewNeedsStaff = true;
    }
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

  it('remounted at 30% (G3b): the Pig gets up enraged and its charges come in runs of three', () => {
    const { s, p, boss } = scene();
    boss.phase = 2;
    boss.hp = boss.maxHp * tuning.grubnose.phase3At - 1;
    stepEnemies(s, DT, world);
    expect(boss.ai).toBe('roar');
    expect(s.events.find((e) => e.kind === 'roar')).toEqual({ kind: 'roar', enemyId: boss.id, phase: 3, chief: true });
    until(s, p, () => boss.ai !== 'roar');
    expect(boss.phase).toBe(3);
    until(s, p, () => boss.ai === 'chase');
    Object.assign(boss, { x: 0, z: p.z - 8, yaw: 0, cooldown: 0 });
    // Each charge of the run winds up again at once, the second and third on the shorter turn.
    const seen: string[] = [];
    let longest = 0;
    let windup = 0;
    for (let i = 0; i < 900 && !(boss.ai === 'recover' || boss.ai === 'stagger' || boss.ai === 'aim'); i++) {
      if (boss.ai === 'chargeWindup' && seen.at(-1) !== boss.attack) seen.push(boss.attack);
      windup = boss.ai === 'chargeWindup' ? windup + 1 : 0;
      if (boss.attack !== 'rush1') longest = Math.max(longest, windup);
      stepEnemies(s, DT, world);
      Object.assign(p, { x: 0, z: EDGE - 3 });
    }
    expect(seen).toEqual(['rush1', 'rush2', 'rush3']);
    expect(longest).toBeLessThanOrEqual(Math.ceil((tuning.grubnose.rushTelegraphMs / 1000) * 60) + 1);
    expect(telegraphColour({ kind: 'grubnose', attack: 'rush1' })).toBe('strike');
    expect(telegraphColour({ kind: 'grubnose', attack: 'rush3' })).toBe('heavy');
    expect(attackType({ kind: 'grubnose', attack: 'rush3' })).toBe('blunt');
  });

  it('a wall turns the first two charges of a run; the third it meets stuns him', () => {
    const { s, p, boss } = scene();
    Object.assign(boss, { phase: 3, attack: 'rush1', ai: 'charge', aiTime: 0, x: 0, z: EDGE - 4, yaw: 0 });
    // The hero aside and untouchable, so nothing but the wall ends the rush.
    Object.assign(p, { x: 6, z: EDGE - 8, invulnerable: true });
    until(s, p, () => boss.ai !== 'charge', 120);
    expect(boss.ai).toBe('chargeWindup');
    expect(boss.attack).toBe('rush2');
    Object.assign(boss, { attack: 'rush3', ai: 'charge', aiTime: 0, x: 0, z: EDGE - 4, yaw: 0 });
    until(s, p, () => boss.ai !== 'charge', 120);
    expect(boss.ai).toBe('stagger');
  });

  it("a guard stops the run's first charge dead, but the rimmed third breaks it", () => {
    const run = (attack: string) => {
      const { s, p, boss } = scene();
      Object.assign(boss, { phase: 3, attack, ai: 'charge', aiTime: 0, x: 0, z: p.z - 4, yaw: 0 });
      Object.assign(p, { mode: 'guard', guardTime: 1, parryOpen: false });
      until(s, p, () => boss.ai !== 'charge', 120);
      return { boss: boss.ai, broke: s.events.some((e) => e.kind === 'block' && e.broke) };
    };
    expect(run('rush1')).toEqual({ boss: 'stagger', broke: false });
    const third = run('rush3');
    expect(third.boss).not.toBe('stagger');
    expect(third.broke).toBe(true);
  });

  it('the Saltmarsh Warrens are the Warrens (G3b): goblins on the menu and in every room of the run', () => {
    const story = STORY.find((d) => d.id === 'saltmarsh')!;
    expect(story.type).toBe('goblinWarrens');
    expect(story.enemies.every((k) => roomKindIn(k, 'hauntedCrypt') === k && (GOBLINS.has(k) || k === 'grubnose'))).toBe(true);
    const plan = planChoice([], 1, { kind: 'story', id: 'saltmarsh' });
    expect(plan.type).toBe('goblinWarrens');
    for (let f = 1; f <= plan.floors; f++) expect(floorSpecFor(plan, f).type).toBe('goblinWarrens');
  });

  it("a random Warrens run ends on Grubnose, a random Crypt run on the Warden, a story on its own (docs/bosses.md 3)", () => {
    const random = (type?: 'goblinWarrens' | 'hauntedCrypt') =>
      planChoice([], 7, { kind: 'random', floors: 3, size: 'small', difficulty: 1, modifier: null, ...(type ? { type } : {}) });
    const last = (plan: ReturnType<typeof random>) => floorSpecFor(plan, plan.floors);
    const warrens = last(random('goblinWarrens'));
    expect(bossOf(warrens.story, warrens.type)).toBe('grubnose');
    const crypt = last(random('hauntedCrypt'));
    expect(bossOf(crypt.story, crypt.type)).toBe('warden');
    const old = last(random());
    expect(bossOf(old.story, old.type)).toBe('warden');
    // A story keeps the boss written for it, whatever its type.
    expect(bossOf('old-cellar', 'goblinWarrens')).toBe('warden');
    expect(bossOf('mossgate', 'goblinWarrens')).toBe('gravehand');
    tuning.grubnose.enabled = false;
    expect(bossOf(warrens.story, warrens.type)).toBe('warden');
  });

  it("the Warrens are open on Wren's Random tab; the six without a roster stay shut", () => {
    const choice = (type: string) => readPortalChoice({ kind: 'random', floors: 3, size: 'small', difficulty: 1, modifier: null, type });
    expect(DUNGEON_TYPES.goblinWarrens.open).toBe(true);
    expect(choice('goblinWarrens')).toMatchObject({ kind: 'random', type: 'goblinWarrens' });
    expect(choice('hauntedCrypt')).toMatchObject({ type: 'hauntedCrypt' });
    expect(choice('wizardTower')).toBeNull();
    expect(choice('frozenBarrows')).toBeNull();
  });
});
