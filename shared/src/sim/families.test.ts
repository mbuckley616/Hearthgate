import { describe, expect, it } from 'vitest';
import { FAMILY_ANIM, tuning, type Style } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { damageEnemy, hurtHero } from './combat';
import { wornMods, type GearItem, type Worn } from './catalogue';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel, type Mods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents, heroHit } from './talents';
import { idleCommand, type PlayerCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const item = (id: string): GearItem => ({ uid: id, id, rarity: 'common', perk: null, bonus: null });

function hero(mods: Partial<Mods>, style: Style, n = 1) {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 };
  const ps = Array.from({ length: n }, (_, i) => addPlayer(s, world, `p${i + 1}`, l, false));
  for (const p of ps) {
    p.style = style;
    p.invulnTime = 0;
  }
  return { s, p: ps[0], ps };
}

const press = (s: SimState, p: PlayerState, over: Partial<PlayerCommand> = {}, ticks = 1) => {
  for (let i = 0; i < ticks; i++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, ...(i === 0 ? over : {}) }, DT, world, s);
};

/** Tap through n steps of the chain, each press in the buffer; the steps and borrowed poses played. */
function chain(s: SimState, p: PlayerState, n: number) {
  const steps: [number, number][] = [];
  let seq = -1;
  for (let t = 0; t < 2000 && steps.length < n; t++) {
    const h = heroHit(p, p.attackHit);
    const ready = p.mode === 'move' || (p.mode === 'attack' && p.attackSeq !== seq && p.attackTime >= h.windup + h.active - 0.05);
    const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1, attack: ready };
    if (ready) seq = p.attackSeq;
    const before = p.attackSeq;
    stepPlayer(p, cmd, DT, world, s);
    if (p.attackSeq !== before) steps.push([p.attackStep ?? p.attackHit, p.attackHit]);
  }
  // Let the last step fire.
  for (let t = 0; t < 20; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  return steps;
}

describe('weapon families (C5)', () => {
  it('plays a warhammer as three heavy blows, borrowing the sword’s sweep, spin and slam', () => {
    const { s, p } = hero({ family: 'warhammer' }, 'sword');
    expect(chain(s, p, 4)).toEqual([[0, 2], [1, 3], [2, 4], [0, 2]]);
    p.attackStep = 2;
    expect(heroHit(p, 4).damage).toBeCloseTo(tuning.warhammerCombo.hit3Damage * tuning.combat.baseDamage);
    expect(heroHit(p, 4).heavy).toBe(true);
  });

  it('plays a mace as three bashes and an overhead crush, each breaking more poise than the sword’s step it borrows', () => {
    const { s, p } = hero({ family: 'mace' }, 'sword');
    expect(chain(s, p, 5)).toEqual([[0, 0], [1, 1], [2, 0], [3, 4], [0, 0]]);
    const sword = hero({}, 'sword').p;
    for (const [step, anim] of FAMILY_ANIM.mace.entries()) {
      p.attackStep = step;
      expect(heroHit(p, anim).poise).toBeGreaterThan(heroHit(sword, anim).poise);
    }
    p.attackStep = 3;
    expect(heroHit(p, 4).heavy).toBe(true);
    expect(heroHit(p, 4).damage).toBeCloseTo(tuning.maceCombo.hit4Damage * tuning.combat.baseDamage);
    // Slower than the sword's first slash: a mace is weight in one hand.
    p.attackStep = 0;
    expect(heroHit(p, 0).windup).toBeGreaterThan(heroHit(sword, 0).windup);
  });

  it('wears a mace, an axe or daggers in one hand, with a shield and its bash', () => {
    const w = (...pairs: [keyof Worn, string][]): Worn => Object.fromEntries(pairs.map(([slot, id]) => [slot, item(id)]));
    const m = wornMods(w(['weapon', 'bronze-mace'], ['shield', 'bronze-squareShield']));
    expect(m).toMatchObject({ family: 'mace', offhand: 'shield' });
    expect(wornMods(w(['weapon', 'bronze-mace'], ['shield', 'linen-tome'])).offhand).toBeUndefined();
    expect(wornMods(w(['weapon', 'bronze-axe'], ['shield', 'bronze-kiteshield']))).toMatchObject({ family: 'axe', offhand: 'shield' });
    expect(wornMods(w(['weapon', 'bronze-daggers'], ['shield', 'bronze-squareShield']))).toMatchObject({ family: 'daggers', offhand: 'shield' });
    const base = { name: 'Ann', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), maxHp: 100 };
    expect(readLoadout({ ...base, mods: { ...emptyMods(), family: 'mace', offhand: 'shield' } })?.mods).toMatchObject({ family: 'mace', offhand: 'shield' });
  });

  it('plays an axe as two wide chops and a spinning cleave: more damage than the sword’s step for step, less poise', () => {
    const { s, p } = hero({ family: 'axe' }, 'sword');
    expect(chain(s, p, 4)).toEqual([[0, 2], [1, 1], [2, 3], [0, 2]]);
    const sword = hero({}, 'sword').p;
    for (const [step, anim] of FAMILY_ANIM.axe.entries()) {
      p.attackStep = step;
      expect(heroHit(p, anim).damage).toBeGreaterThan(heroHit(sword, step).damage);
      expect(heroHit(p, anim).poise).toBeLessThan(heroHit(sword, step).poise);
    }
    p.attackStep = 2;
    expect(heroHit(p, 3).heavy).toBe(true);
  });

  it('opens a bleed with an axe’s heavy, and not with its light chops or a sword’s heavy', () => {
    const struck = (family: Mods['family'], heavy: boolean) => {
      const { s, p } = hero(family ? { family } : {}, 'sword');
      const e = createEnemy(s, world, 'brute', p.x, p.z + 2, Math.PI);
      e.ai = 'chase';
      s.enemies.push(e);
      damageEnemy(s, e, { attackerId: p.id, damage: 5, poise: 0, knockback: 0, heavy, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style: 'sword' });
      return e;
    };
    const cleft = struck('axe', true);
    expect(cleft.bleedTicks).toBe(tuning.gear.bleedTicks);
    expect(cleft.bleedOwner).toBe('p1');
    expect(struck('axe', false).bleedTicks).toBe(0);
    expect(struck(undefined, true).bleedTicks).toBe(0);
  });

  it('plays daggers as four quick stabs and a hamstring slash, quicker than the sword', () => {
    const { s, p } = hero({ family: 'daggers' }, 'sword');
    expect(chain(s, p, 6)).toEqual([[0, 0], [1, 1], [2, 0], [3, 1], [4, 2], [0, 0]]);
    const sword = hero({}, 'sword').p;
    p.attackStep = 0;
    const stab = heroHit(p, 0);
    const slash = heroHit(sword, 0);
    expect(stab.windup + stab.active + stab.recovery).toBeLessThan(slash.windup + slash.active + slash.recovery);
    p.attackStep = 4;
    expect(heroHit(p, 2).heavy).toBe(true);
  });

  it('lands a dagger’s blow from behind harder, and only a dagger’s', () => {
    const stabbed = (family: Mods['family'], behind: boolean) => {
      const { s, p } = hero(family ? { family } : {}, 'sword');
      // The brute faces +z; the hero stands 1.5 m behind it (-z) or in front (+z).
      const e = createEnemy(s, world, 'brute', p.x, p.z, 0);
      Object.assign(e, { ai: 'chase', yaw: 0, x: p.x, z: p.z + (behind ? 1.5 : -1.5) });
      s.enemies.push(e);
      const hp = e.hp;
      damageEnemy(s, e, { attackerId: p.id, damage: 5, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style: 'sword' });
      return hp - e.hp;
    };
    const front = stabbed('daggers', false);
    expect(stabbed('daggers', true) / front).toBeCloseTo(tuning.families.daggersBackstabMult);
    expect(stabbed(undefined, true)).toBeCloseTo(stabbed(undefined, false));
  });

  it('looses a longbow’s two long shots and a piercing war shot, faster than the bow’s arrows', () => {
    const lb = hero({ family: 'longbow' }, 'bow');
    expect(chain(lb.s, lb.p, 3).map((x) => x[1])).toEqual([...FAMILY_ANIM.longbow]);
    // The speed of each arrow as it leaves the string, quick and charged.
    const loosed = (family?: 'longbow') => {
      const { s, p } = hero(family ? { family } : {}, 'bow');
      const seen = new Map<boolean, number>();
      for (let t = 0; t < 400 && seen.size < 2; t++) {
        press(s, p, { attack: t % 10 === 0 });
        for (const pr of s.projectiles) if (pr.kind === 'arrow' && !seen.has(!!pr.charged)) seen.set(!!pr.charged, Math.hypot(pr.vx, pr.vy, pr.vz));
      }
      return seen;
    };
    const fast = loosed('longbow');
    const plain = loosed();
    for (const charged of [false, true]) expect(fast.get(charged)! / plain.get(charged)!).toBeCloseTo(tuning.families.longbowArrowSpeedMult);
    const bow = hero({}, 'bow');
    lb.p.attackStep = 0;
    expect(heroHit(lb.p, 0).damage).toBeGreaterThan(heroHit(bow.p, 0).damage);
  });

  it('fires a crossbow’s piercing third bolt, and a wand’s five quick ones', () => {
    const xb = hero({ family: 'crossbow' }, 'bow');
    expect(chain(xb.s, xb.p, 3).map((x) => x[1])).toEqual([...FAMILY_ANIM.crossbow]);
    const charged = xb.s.projectiles.filter((pr) => pr.kind === 'arrow' && pr.charged);
    expect(charged.length).toBeGreaterThan(0);
    const wand = hero({ family: 'wand' }, 'staff');
    chain(wand.s, wand.p, 5);
    expect(wand.s.projectiles.every((pr) => pr.kind === 'bolt')).toBe(true);
    expect(wand.s.projectiles.length).toBeGreaterThanOrEqual(4);
  });

  it('ignores a family that is not of the style in hand, so the slice’s weapons play as ever', () => {
    const { s, p } = hero({ family: 'crossbow' }, 'sword');
    expect(chain(s, p, 3).map((x) => x[1])).toEqual([0, 1, 2]);
    expect(p.attackStep).toBeUndefined();
  });

  it('wears each with the off-hand of its kind, and the warhammer in both hands', () => {
    const w = (...pairs: [keyof Worn, string][]): Worn => Object.fromEntries(pairs.map(([slot, id]) => [slot, item(id)]));
    expect(wornMods(w(['weapon', 'ash-wand'], ['shield', 'linen-tome']))).toMatchObject({ family: 'wand', offhand: 'tome' });
    expect(wornMods(w(['weapon', 'ash-crossbow'], ['shield', 'leather-buckler']))).toMatchObject({ family: 'crossbow', offhand: 'buckler' });
    expect(wornMods(w(['weapon', 'ash-crossbow'], ['shield', 'ash-handCrossbow'])).offhand).toBe('handCrossbow');
    // A tome needs a one-handed magic weapon: not a crossbow, not a two-handed staff.
    expect(wornMods(w(['weapon', 'ash-crossbow'], ['shield', 'linen-tome'])).offhand).toBeUndefined();
    expect(wornMods(w(['weapon', 'ash-staff'], ['shield', 'linen-tome'])).offhand).toBeUndefined();
    expect(wornMods(w(['weapon', 'ash-longbow'], ['shield', 'leather-buckler'])).offhand).toBeUndefined();
    const hammer = wornMods(w(['weapon', 'bronze-warhammer'], ['shield', 'bronze-squareShield']));
    expect(hammer.offhand).toBeUndefined();
    expect(hammer.damage.sword).toBeCloseTo(tuning.gear.twoHandDamage);
  });

  it('wards the caster and the allies near with the tome', () => {
    const { s, ps } = hero({ family: 'wand', offhand: 'tome' }, 'staff', 2);
    const [me, friend] = ps;
    friend.x = me.x + 2;
    press(s, me, { ability3: true }, 30);
    expect(me.ward?.hits).toBe(1);
    expect(friend.ward?.hits).toBe(1);
    const hp = friend.hp;
    expect(hurtHero(s, friend, { damage: 20, fromX: friend.x, fromZ: friend.z + 2 })).toBe('blocked');
    expect(friend.hp).toBe(hp);
    expect(friend.ward).toBeUndefined();
    expect(hurtHero(s, friend, { damage: 20, fromX: friend.x, fromZ: friend.z + 2 })).toBe('hit');
  });

  it('parries every hit while the buckler’s deflect is up', () => {
    const { s, p } = hero({ family: 'crossbow', offhand: 'buckler' }, 'bow');
    const e = createEnemy(s, world, 'grunt', p.x, p.z + 1.5, Math.PI);
    e.x = p.x;
    e.z = p.z + 1.5;
    e.ai = 'chase';
    s.enemies.push(e);
    press(s, p, { ability3: true }, 3);
    expect(hurtHero(s, p, { damage: 20, fromX: e.x, fromZ: e.z, enemyId: e.id })).toBe('parried');
    expect(e.ai).toBe('stagger');
  });

  it('shoots two bolts from the hand crossbow', () => {
    const { s, p } = hero({ family: 'crossbow', offhand: 'handCrossbow' }, 'bow');
    press(s, p, { ability3: true }, 20);
    expect(s.projectiles.filter((pr) => pr.kind === 'arrow')).toHaveLength(2);
    expect(p.offhandCooldown).toBeGreaterThan(0);
  });

  it('takes a family from a browser only if it is one', () => {
    const base = { name: 'Ann', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), maxHp: 100 };
    expect(readLoadout({ ...base, mods: { ...emptyMods(), family: 'wand', offhand: 'tome' } })?.mods).toMatchObject({ family: 'wand', offhand: 'tome' });
    expect(readLoadout({ ...base, mods: { ...emptyMods(), family: 'halberd' } })).toBeNull();
  });
});
