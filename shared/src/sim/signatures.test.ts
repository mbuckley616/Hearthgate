import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readGearItem } from '../net/validate';
import { CATALOGUE, wornMods, type GearItem } from './catalogue';
import { damageEnemy, hurtHero } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { signatureDrops, type FloorRunState } from './floorRun';
import { emptyMods } from './gear';
import { ADD_WEAKNESS } from './roles';
import { SIGNATURES, offerFor, signatureItem, type SignaturePiece } from './signatures';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// B6, part two (docs/bosses.md 1.4 and 1.7): signature pieces as items, folded into Mods, and the
// piece offered by the job a hero did. The list here stands in for a boss's (W1's Warden gives its own).

const LIST: SignaturePiece[] = [
  { job: 'tank', id: 'iron-kiteshield', name: 'Test Tower', signature: { resist: 'blunt' } },
  { job: 'armoured', id: 'ash-staff', name: 'Test Staff', signature: { castSpeed: true } },
  { job: 'boss', id: 'iron-mace', name: 'Test Mace', signature: { bane: 'warden' } },
];

describe('signature pieces by job (B6)', () => {
  it('names real catalogue items', () => {
    for (const p of LIST) expect(CATALOGUE.has(p.id)).toBe(true);
  });

  it('offers each hero the piece of the job they did most', () => {
    expect(offerFor(LIST, { tank: 300, boss: 120 })?.name).toBe('Test Tower');
    expect(offerFor(LIST, { armoured: 90, boss: 60, tank: 10 })?.name).toBe('Test Staff');
    expect(offerFor(LIST, { boss: 400, armoured: 50 })?.name).toBe('Test Mace');
    // Nothing in the list's jobs (only a warded add's damage, and this boss has none): the boss's piece.
    expect(offerFor(LIST, { warded: 80 })?.name).toBe('Test Mace');
    expect(offerFor(LIST, {})?.name).toBe('Test Mace');
    // A tie goes to the list's order.
    expect(offerFor(LIST, { tank: 50, boss: 50 })?.name).toBe('Test Tower');
    expect(offerFor([], { tank: 1 })).toBeNull();
  });

  it('folds two pieces against one type into one resist', () => {
    const tower = signatureItem(LIST[0], 'a');
    const helm: GearItem = { uid: 'b', id: 'iron-fullHelm', rarity: 'rare', perk: null, bonus: null, signature: { resist: 'blunt' } };
    const cap: GearItem = { ...helm, uid: 'c', signature: { resist: 'magic' } };
    expect(wornMods({ shield: tower, head: helm }).resist).toEqual(['blunt']);
    expect(wornMods({ shield: tower, head: cap }).resist?.slice().sort()).toEqual(['blunt', 'magic']);
    expect(wornMods({ head: { ...helm, signature: undefined } }).resist).toBeUndefined();
  });

  it('takes a cast and a bane only from the weapon in hand', () => {
    const staff = signatureItem(LIST[1], 's');
    const mace = signatureItem(LIST[2], 'm');
    expect(wornMods({ weapon: staff }).castSpeed).toBe(true);
    expect(wornMods({ weapon: mace }).bane).toBe('warden');
    expect(wornMods({ weapon: { ...mace, signature: undefined } }).bane).toBeUndefined();
  });

  it('carries a piece through the server’s item check, and refuses a forged one', () => {
    for (const p of LIST) expect(readGearItem(signatureItem(p, 'x'))?.signature).toEqual(p.signature);
    const shield = signatureItem(LIST[0], 'x');
    expect(readGearItem({ ...shield, signature: { castSpeed: true } })).toBeNull();
    expect(readGearItem({ ...shield, signature: { bane: 'warden' } })).toBeNull();
    expect(readGearItem({ ...shield, signature: { resist: 'blunt', castSpeed: true } })).toBeNull();
    expect(readGearItem({ ...shield, signature: { resist: 'fire' } })).toBeNull();
    expect(readGearItem({ ...signatureItem(LIST[2], 'x'), signature: { bane: 'grunt' } })).toBeNull();
  });
});

describe('job scores and the signature drop (B6, part three)', () => {
  const world = buildWorld(arena);
  const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
  const floorState = (): FloorRunState => ({ room: -1, cleared: [], fights: 0, rested: false, carried: {}, broken: [], found: { lumber: 0, stone: 0, coin: 0 }, potions: [] });
  afterEach(() => {
    delete SIGNATURES.warden;
    delete ADD_WEAKNESS.grunt;
  });

  function party(): { s: SimState; a: PlayerState; b: PlayerState; boss: EnemyState } {
    const s = createSimState(arena, [], world);
    s.floor = floorState();
    const a = addPlayer(s, world, 'a', loadout, false);
    const b = addPlayer(s, world, 'b', loadout, false);
    const boss = createEnemy(s, world, 'warden', 0, -9, 0);
    Object.assign(boss, { ai: 'chase', hp: 1e5, maxHp: 1e5, poise: 1e9 });
    return { s, a, b, boss };
  }
  const blow = (id: string, e: EnemyState, damage: number) => ({ attackerId: id, damage, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style: 'staff' as const });

  it('counts damage to the boss and to an armoured add, as far as it went', () => {
    const { s, a, boss } = party();
    ADD_WEAKNESS.grunt = 'armoured';
    const add = createEnemy(s, world, 'grunt', 4, -9, 0);
    Object.assign(add, { ai: 'chase', hp: 5, maxHp: 50 });
    damageEnemy(s, boss, blow(a.id, boss, 10));
    damageEnemy(s, add, blow(a.id, add, 40));
    const jobs = s.floor!.jobs![a.id];
    expect(jobs.boss).toBeGreaterThan(0);
    // The add had 5 health left: the job counts the 5, not the overkill.
    expect(jobs.armoured).toBeCloseTo(5, 6);
  });

  it('counts a boss’s blow taken on a guard as the tank’s', () => {
    const { s, a, boss } = party();
    Object.assign(a, { mode: 'guard', yaw: Math.atan2(boss.x - a.x, boss.z - a.z), parryOpen: false, guardTime: 1, lagGrace: 0, invulnerable: false, invulnTime: 0 });
    hurtHero(s, a, { damage: 30, fromX: boss.x, fromZ: boss.z, enemyId: boss.id });
    expect(s.floor!.jobs![a.id].tank).toBe(30);
  });

  it('drops each hero the piece of their job, theirs alone', () => {
    const { s, a, b } = party();
    SIGNATURES.warden = LIST;
    s.floor!.jobs = { a: { tank: 200, boss: 50 }, b: { boss: 300 } };
    signatureDrops(s, world, 0, -9);
    const mine = (id: string) => s.drops.filter((d) => d.owner === id).map((d) => (d.item as GearItem).name);
    expect(mine(a.id)).toEqual(['Test Tower']);
    expect(mine(b.id)).toEqual(['Test Mace']);
  });

  it('drops nothing for a boss with no list, or with the switch off', () => {
    const { s } = party();
    signatureDrops(s, world, 0, -9);
    expect(s.drops).toHaveLength(0);
    SIGNATURES.warden = LIST;
    const was = tuning.bosses.signatureDrops;
    tuning.bosses.signatureDrops = false;
    signatureDrops(s, world, 0, -9);
    tuning.bosses.signatureDrops = was;
    expect(s.drops).toHaveLength(0);
  });
});
