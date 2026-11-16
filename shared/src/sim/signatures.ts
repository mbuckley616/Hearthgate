import type { EnemyKind } from '../config/tuning';
import type { GearItem, Signature } from './catalogue';

/**
 * A boss's signature drops by job (B6; `docs/bosses.md` 1.4 and 1.7; Michael's A on specializing, 16
 * Nov): each boss has a list of two or three pieces, each answering one of its jobs, and a hero is
 * offered the piece of the job they did most in that fight. So a specialist farms gear for their
 * specialty. Each boss's list comes with its line (W1, K1, H3, M3); none is filled yet.
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

export const SIGNATURES: Partial<Record<EnemyKind, readonly SignaturePiece[]>> = {};

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
