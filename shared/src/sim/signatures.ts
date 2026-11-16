import { tuning, type EnemyKind } from '../config/tuning';
import type { GearItem, Signature } from './catalogue';
import { ADD_WEAKNESS, roleOf } from './roles';
import type { EnemyState, PlayerState, SimState } from './types';

/**
 * A boss's signature drops by job (B6; `docs/bosses.md` 1.4 and 1.7; Michael's A on specializing, 16
 * Nov): each boss has a list of two or three pieces, each answering one of its jobs, and a hero is
 * offered the piece of the job they did most in that fight. So a specialist farms gear for their
 * specialty. Each boss's list comes with its line (W1, K1, H3, M3): the Gravehand's (H3) and the
 * Ossuary Mason's (M3) are in.
 *
 * The jobs (1.1, 1.6): `tank` takes the boss's close string on a guard, `armoured` and `warded` are
 * damage to those adds (1.3), and `boss` is damage to the boss itself, the job a bane answers.
 */
export type Job = 'tank' | 'armoured' | 'warded' | 'boss';

export interface SignaturePiece {
  job: Job;
  /** The catalogue item it is made as (its slot, shape and material). */
  id: string;
  name: string;
  signature: Signature;
}

export const SIGNATURES: Partial<Record<EnemyKind, readonly SignaturePiece[]>> = {
  // The Gravehand (H3; `docs/bosses.md` 2.1): the tank's buckler against its slams, sweep and knuckles;
  // the archer's bow, its bane, for the hero who broke the Silver Ring's ward; and for the one it
  // went after most, the wraps its grip slips off.
  gravehand: [
    { job: 'tank', id: 'studded-buckler', name: 'Ringward Buckler', signature: { resist: 'blunt' } },
    { job: 'warded', id: 'yew-shortbow', name: 'Knucklebone Bow', signature: { bane: 'gravehand' } },
    { job: 'boss', id: 'linen-gloves', name: 'Grave-cloth Wraps', signature: { looseGrip: true } },
  ],
  // The Ossuary Mason (M3; 2.2): the tank's shield against its maul, hod and shockwave, and for the
  // mage who broke its Mortar Guards' plate, a staff that casts faster. The document's bone staff is
  // elm here: the catalogue has no bone. The Gallery Longbow, the warded job's, is Michael's to keep.
  mason: [
    { job: 'tank', id: 'iron-kiteshield', name: 'Mortarward Shield', signature: { resist: 'blunt' } },
    { job: 'armoured', id: 'elm-staff', name: "Chanter's Staff", signature: { castSpeed: true } },
  ],
};

/** What a hero did in a boss fight, by job: damage blocked for `tank`, damage dealt for the rest. */
export type JobScores = Partial<Record<Job, number>>;

/**
 * The piece a hero is offered: the one whose job they scored most in, the list's order breaking a tie.
 * A hero who scored in none of the list's jobs (they kept the boss busy some other way) gets its
 * `boss` piece, or the first. Pure, so the server and a test agree.
 */
export function offerFor(list: readonly SignaturePiece[], scores: JobScores): SignaturePiece | null {
  if (list.length === 0) return null;
  let best: SignaturePiece | null = null;
  let most = 0;
  for (const piece of list) {
    const s = scores[piece.job] ?? 0;
    if (s > most) {
      best = piece;
      most = s;
    }
  }
  return best ?? list.find((p) => p.job === 'boss') ?? list[0];
}

/** The piece as an item someone owns: a named rare with its one property, no perk or bonus. */
export function signatureItem(piece: SignaturePiece, uid: string): GearItem {
  return { uid, id: piece.id, rarity: 'rare', perk: null, bonus: null, name: piece.name, signature: { ...piece.signature } };
}

/** The job a hit on `e` does: the boss itself, or an add by its weakness; null for anything else. */
export function jobFor(e: EnemyState): Job | null {
  if (roleOf(e.kind) === 'boss') return 'boss';
  const w = ADD_WEAKNESS[e.kind];
  return w ?? null;
}

/**
 * Count `amount` toward a hero's `job` on this floor (part three): damage dealt for a boss or an add,
 * a boss's blow taken on a guard for the tank. Heroes only; a floor only, where a boss can drop.
 */
export function noteJob(state: SimState, hero: PlayerState | undefined, job: Job | null, amount: number): void {
  const f = state.floor;
  if (!f || !hero || hero.henchman || !job || !(amount > 0) || !tuning.bosses.signatureDrops) return;
  const mine = ((f.jobs ??= {})[hero.id] ??= {});
  mine[job] = (mine[job] ?? 0) + amount;
}
