import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { mergePresses, withoutPresses } from '../game/Session';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { wornMods, type GearItem, type Worn } from './catalogue';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { spawnArrow, stepProjectiles } from './projectiles';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const item = (id: string): GearItem => ({ uid: id, id, rarity: 'common', perk: null, bonus: null });
const worn = (...ids: string[]): Worn => {
  const w: Worn = {};
  for (const id of ids) {
    const slot = id.endsWith('Shield') || id.endsWith('kiteshield') ? 'shield' : id.endsWith('arrows') ? 'ammo' : 'weapon';
    w[slot] = item(id);
  }
  return w;
};

function hero(mods = emptyMods(), style: PlayerState['style'] = 'sword') {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods, maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = style;
  p.invulnTime = 0;
  return { s, p };
}

function grunt(s: SimState, p: PlayerState, ahead: number) {
  const e = createEnemy(s, world, 'grunt', p.x, p.z + ahead, Math.PI);
  e.x = p.x;
  e.z = p.z + ahead;
  e.y = p.y;
  e.hp = e.maxHp = 10000;
  e.ai = 'chase';
  s.enemies.push(e);
  return e;
}

const step = (s: SimState, p: PlayerState, over: Partial<PlayerCommand> = {}, n = 1) => {
  for (let i = 0; i < n; i++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, ...over }, 1 / 60, world, s);
};

const kept = { ...tuning.gear };
afterEach(() => Object.assign(tuning.gear, kept));

describe('the off-hand, two hands and the ammo slot (C4)', () => {
  it('lets a one-handed weapon use an off-hand of its kind, and pays two hands for going without', () => {
    expect(wornMods(worn('bronze-sword', 'bronze-squareShield')).offhand).toBe('shield');
    // A bow takes both hands: the shield is slung on the back, and the bow hits harder for it.
    const bow = wornMods(worn('ash-shortbow', 'bronze-squareShield'));
    expect(bow.offhand).toBeUndefined();
    expect(bow.damage.bow).toBeCloseTo(tuning.gear.twoHandDamage);
    expect(wornMods(worn('bronze-sword')).damage.sword).toBe(0);
  });

  it('puts arrows to work only with a bow, at no cost to anything else', () => {
    expect(wornMods(worn('ash-shortbow', 'frost-arrows')).ammo).toBe('frost');
    expect(wornMods(worn('ash-shortbow', 'barbed-arrows')).ammo).toBe('barbed');
    const sword = wornMods(worn('bronze-sword', 'frost-arrows'));
    expect(sword.ammo).toBeUndefined();
    expect(sword.damage.sword).toBe(0);
  });

  it('bashes the nearest enemy in front off its feet on 3, then waits out its cooldown', () => {
    const { s, p } = hero({ ...emptyMods(), offhand: 'shield' });
    const e = grunt(s, p, 1.4);
    step(s, p, { ability3: true });
    step(s, p, {}, 30);
    expect(e.ai).toBe('stagger');
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(p.offhandCooldown).toBeGreaterThan(0);
    // Without an off-hand, 3 does nothing.
    const bare = hero();
    grunt(bare.s, bare.p, 1.4);
    step(bare.s, bare.p, { ability3: true });
    expect(bare.p.mode).toBe('move');
  });

  it('slows what a frost arrow hits, and bleeds what a barbed charged shot hits', () => {
    const shoot = (ammo: 'frost' | 'barbed', charged: boolean) => {
      const { s, p } = hero({ ...emptyMods(), ammo }, 'bow');
      const e = grunt(s, p, 4);
      spawnArrow(s, p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0, tuning.rangedCombo.arrowSpeed, charged);
      for (let i = 0; i < 60 && s.projectiles.length > 0; i++) stepProjectiles(s, 1 / 60, world.colliders);
      return e;
    };
    expect(shoot('frost', false).slowTime).toBeGreaterThanOrEqual(tuning.gear.frostArrowSlowS - 0.05);
    expect(shoot('barbed', true).bleedTicks).toBe(tuning.gear.bleedTicks);
    expect(shoot('barbed', false).bleedTicks).toBe(0);
  });

  it('takes an off-hand and ammo from a browser only of kinds there are, and carries the press across a late input', () => {
    const base = { name: 'Ann', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), maxHp: 100 };
    expect(readLoadout({ ...base, mods: { ...emptyMods(), offhand: 'shield', ammo: 'frost' } })?.mods).toMatchObject({ offhand: 'shield', ammo: 'frost' });
    expect(readLoadout({ ...base, mods: { ...emptyMods(), offhand: 'cauldron' } })).toBeNull();
    expect(readLoadout({ ...base, mods: { ...emptyMods(), ammo: 'fire' } })).toBeNull();
    const pressed: PlayerCommand = { ...idleCommand(), ability3: true };
    expect(mergePresses(pressed, idleCommand()).ability3).toBe(true);
    expect(withoutPresses(pressed).ability3).toBeUndefined();
  });
});
