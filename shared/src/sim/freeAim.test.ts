import { describe, expect, it } from 'vitest';
import { arena, buildWorld } from '../level/arena';
import { readCommand } from '../net/validate';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

/** An archer facing +z with a grunt a little off to the right, who shoots once with `aim`. */
function shoot(aim: Partial<PlayerCommand>, lock = false) {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  p.style = 'bow';
  p.invulnTime = 0;
  p.yaw = 0;
  const e = createEnemy(s, world, 'grunt', p.x + 2, p.z + 8, Math.PI);
  e.x = p.x + 2;
  e.z = p.z + 8;
  e.y = p.y;
  e.ai = 'chase';
  s.enemies.push(e);
  const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1, ...aim, lockTarget: lock ? e.id : -1 };
  stepPlayer(p, { ...cmd, attack: true }, DT, world, s);
  for (let i = 0; i < 60 && s.projectiles.length === 0; i++) stepPlayer(p, cmd, DT, world, s);
  const arrow = s.projectiles[0];
  return { p, e, arrow };
}

describe('free aim over the shoulder (D12)', () => {
  it('flies along the sent pitch and heading, with no soft target turning it', () => {
    const { p, arrow } = shoot({ aimPitch: 0.3 });
    expect(arrow).toBeDefined();
    expect(p.attackTarget).toBe(-1);
    expect(Math.atan2(arrow.vy, Math.hypot(arrow.vx, arrow.vz))).toBeCloseTo(0.3, 5);
    expect(Math.atan2(arrow.vx, arrow.vz)).toBeCloseTo(0, 5);
  });

  it('leaves where the player points at release, not where the draw began', () => {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    p.style = 'bow';
    p.yaw = 0;
    const turned = { aimX: Math.sin(0.5), aimZ: Math.cos(0.5), aimPitch: -0.1 };
    stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, aimPitch: 0, attack: true }, DT, world, s);
    for (let i = 0; i < 60 && s.projectiles.length === 0; i++) stepPlayer(p, { ...idleCommand(), ...turned }, DT, world, s);
    const arrow = s.projectiles[0];
    expect(Math.atan2(arrow.vx, arrow.vz)).toBeCloseTo(0.5, 5);
    expect(Math.atan2(arrow.vy, Math.hypot(arrow.vx, arrow.vz))).toBeCloseTo(-0.1, 5);
  });

  it('keeps the slice’s aim at the target when locked on, or when no pitch is sent', () => {
    // The grunt stands about 14 degrees right of the aim: the slice's aim turns the shot onto it.
    const toGrunt = Math.atan2(2, 8);
    for (const { arrow, p } of [shoot({ aimPitch: 0.3 }, true), shoot({})]) {
      expect(Math.atan2(arrow.vx, arrow.vz)).toBeCloseTo(toGrunt, 1);
      expect(Math.atan2(arrow.vy, Math.hypot(arrow.vx, arrow.vz))).toBeLessThan(0.1);
      void p;
    }
    expect(shoot({}).p.aimPitch).toBeUndefined();
  });

  it('takes a pitch from the wire only as a number, and no further than straight up or down', () => {
    const base = { ...idleCommand(), aimX: 0, aimZ: 1 };
    expect(readCommand({ ...base, aimPitch: 0.4 })?.aimPitch).toBe(0.4);
    expect(readCommand({ ...base, aimPitch: 9 })?.aimPitch).toBeCloseTo(Math.PI / 2, 9);
    expect(readCommand({ ...base, aimPitch: 'up' })).toBeNull();
    expect('aimPitch' in readCommand(base)!).toBe(false);
  });
});
