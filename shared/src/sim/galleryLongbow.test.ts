import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readGearItem, readLoadout } from '../net/validate';
import { wornMods } from './catalogue';
import { damageEnemy } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { SIGNATURES, signatureItem } from './signatures';
import { emptyTalents } from './talents';
import { createSimState } from './world';

// The Mason's third drop (Michael, 17 Nov, A; docs/bosses.md 2.2): the Gallery Longbow, whose arrow
// that breaks a Bone Chanter's rebuild stuns it 1 s.

const world = buildWorld(arena);
const piece = SIGNATURES.mason!.find((p) => p.name === 'Gallery Longbow')!;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { on: tuning.bosses.signatureDrops, weak: tuning.bosses.addWeakness };
afterEach(() => {
  tuning.bosses.signatureDrops = kept.on;
  tuning.bosses.addWeakness = kept.weak;
});

/** The Chanter's time out after `style`'s hit breaks its rebuild, the hero wearing the bow or not. */
function brokenFor(bow: boolean, style: 'bow' | 'sword' = 'bow'): number {
  const s = createSimState(arena, [], world);
  addPlayer(s, world, 'p1', { ...loadout, mods: { ...emptyMods(), ...(bow ? { channelStun: true } : {}) } }, false);
  const c = createEnemy(s, world, 'chanter', 6, 6, 0);
  Object.assign(c, { ai: 'chant', aiTime: 0, maxHp: 1000, hp: 1000, tele: { shape: 'circle', x: 6, z: 6, radius: 1, yaw: 0, arcDeg: 360 } });
  damageEnemy(s, c, { attackerId: 'p1', damage: 1, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: c.x, y: 1, z: c.z, style, projectile: style === 'bow' });
  expect(c.ai).toBe('recover');
  return c.recoverTime;
}

describe('the Gallery Longbow (M3)', () => {
  it("is the archer's piece, a yew shortbow the server takes back, worn only as a bow", () => {
    expect(piece.job).toBe('warded');
    const item = signatureItem(piece, 'a');
    expect(item.id).toBe('yew-shortbow');
    expect(readGearItem(item)?.signature).toEqual({ channelStun: true });
    expect(wornMods({ weapon: item }).channelStun).toBe(true);
    // Not on a sword, and only as a flag.
    expect(readGearItem({ ...signatureItem(SIGNATURES.king![2], 'b'), signature: { channelStun: true } })).toBeNull();
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), channelStun: true } })?.mods.channelStun).toBe(true);
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), channelStun: 1 } })).toBeNull();
  });

  it('an arrow of it that breaks a rebuild stuns the Chanter 1 s; without it, or with drops off, the usual break', () => {
    tuning.bosses.addWeakness = true;
    tuning.bosses.signatureDrops = true;
    const plain = brokenFor(false);
    expect(plain).toBeCloseTo(tuning.wraith.brokenMs / 1000, 5);
    expect(brokenFor(true)).toBeCloseTo(Math.max(plain, tuning.chanter.galleryStunMs / 1000), 5);
    expect(brokenFor(true)).toBeGreaterThan(plain);
    tuning.bosses.signatureDrops = false;
    expect(brokenFor(true)).toBeCloseTo(plain, 5);
  });
});
