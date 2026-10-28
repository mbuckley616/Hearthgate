import { describe, expect, it } from 'vitest';
import { FAMILY_ANIM, tuning, type Style } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { hurtHero } from './combat';
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
