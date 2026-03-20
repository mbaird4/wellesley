/** Individual pitch codes from boxscore data */
export type PitchCode = 'K' | 'S' | 'B' | 'F' | 'H';

/** Parsed pitch sequence from a single plate appearance */
export interface PitchSequence {
  balls: number;
  strikes: number;
  /** Ordered pitch-by-pitch sequence */
  pitches: PitchCode[];
  /** Any unrecognized pitch letters (should be flagged) */
  unknownCodes: string[];
}

/** Full context for a single at-bat's pitch data */
export interface PitchSequenceRecord {
  gameUrl: string;
  opponent: string;
  date: string;
  inning: string;
  outs: number;
  basesBefore: { first: boolean; second: boolean; third: boolean };
  pitcherName: string;
  batterName: string;
  batterResult: string;
  sequence: PitchSequence;
  playText: string;
}
