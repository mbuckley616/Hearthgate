import { describe, expect, it } from 'vitest';
import { emptyMods } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { idleCommand } from '../sim/types';
import { PROTOCOL_VERSION } from './protocol';
import { MAX_CMDS_PER_MESSAGE, readCommand, readLoadout, readToHost } from './validate';

const loadout = () => ({ name: 'Ann', xp: { sword: 10, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 });

describe('what the server accepts from a player', () => {
  it('a command as the slice builds one, with the stick clamped to length 1', () => {
    const c = readCommand({ ...idleCommand(), moveX: 3, moveZ: 4 });
    expect(c?.moveX).toBeCloseTo(0.6);
    expect(c?.moveZ).toBeCloseTo(0.8);
    expect(readCommand({ ...idleCommand(), swapTo: 'bow' })?.swapTo).toBe('bow');
  });

  it('refuses commands with missing, wrong or non-finite fields', () => {
    expect(readCommand({ ...idleCommand(), moveX: NaN })).toBeNull();
    expect(readCommand({ ...idleCommand(), attack: 1 })).toBeNull();
    expect(readCommand({ ...idleCommand(), swapTo: 'axe' })).toBeNull();
    const { jump: _, ...noJump } = idleCommand();
    expect(readCommand(noJump)).toBeNull();
    expect(readCommand('hi')).toBeNull();
  });

  it('refuses an input message with too many ticks or a bad seq', () => {
    const cmds = (n: number, seq = 1) => Array.from({ length: n }, (_, i) => ({ seq: seq + i, cmd: idleCommand() }));
    expect(readToHost({ k: 'input', cmds: cmds(3) })).not.toBeNull();
    expect(readToHost({ k: 'input', cmds: cmds(MAX_CMDS_PER_MESSAGE + 1) })).toBeNull();
    expect(readToHost({ k: 'input', cmds: cmds(1, 0) })).toBeNull();
    expect(readToHost({ k: 'input', cmds: [{ seq: 1.5, cmd: idleCommand() }] })).toBeNull();
  });

  it('a loadout as the slice saves one; anything that could break the fight is refused', () => {
    expect(readLoadout(loadout())?.name).toBe('Ann');
    expect(readLoadout({ ...loadout(), name: '<b>Ann</b>' })?.name).toBe('bAnnb');
    expect(readLoadout({ ...loadout(), maxHp: 0 })).toBeNull();
    expect(readLoadout({ ...loadout(), xp: { sword: 1 } })).toBeNull();
    expect(readLoadout({ ...loadout(), mods: { ...emptyMods(), perks: ['wings'] } })).toBeNull();
    expect(readLoadout({ ...loadout(), talents: { ...emptyTalents(), sword: { flight: 1 } } })).toBeNull();
  });

  it('only the message kinds the protocol has', () => {
    expect(readToHost({ k: 'hello', version: PROTOCOL_VERSION, loadout: loadout() })?.k).toBe('hello');
    expect(readToHost({ k: 'cheat', cheat: 'warden' })?.k).toBe('cheat');
    expect(readToHost({ k: 'cheat', cheat: 'win' })).toBeNull();
    expect(readToHost({ k: 'tune', edit: { path: 'movement.runSpeed', value: '9' } })).toBeNull();
    expect(readToHost({ k: 'snap' })).toBeNull();
    expect(readToHost(null)).toBeNull();
  });
});
