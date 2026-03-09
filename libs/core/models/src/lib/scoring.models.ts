import type { BaseSituation } from './snapshot.models';

export type ScoringPlayType =
  | 'homer'
  | 'triple'
  | 'double'
  | 'single'
  | 'bunt_single'
  | 'sac_fly'
  | 'sac_bunt'
  | 'walk'
  | 'hbp'
  | 'wild_pitch'
  | 'passed_ball'
  | 'stolen_base'
  | 'fielders_choice'
  | 'error'
  | 'productive_out'
  | 'unknown';

export interface ScoringPlay {
  runnerName: string | null;
  scoringPlayType: ScoringPlayType;
  batterName: string | null;
  lineupSlot: number | null;
  inning: string;
  outs: number;
  baseSituation: BaseSituation;
  playText: string;
}

export interface ScoringPlaySummary {
  totalRuns: number;
  byType: Record<string, number>;
  byRunner: Record<string, number>;
  byBatter: Record<string, number>;
}

export interface GameScoringPlays {
  url: string;
  opponent: string;
  plays: ScoringPlay[];
  summary: ScoringPlaySummary;
}

export interface SacBuntOutcome {
  opponent: string;
  url: string;
  inning: string;
  batterName: string | null;
  runnersOnBase: string[];
  runnersScored: string[];
}

export interface SacBuntSummary {
  totalSacBunts: number;
  totalRunnersOnBase: number;
  totalRunnersScored: number;
  scoringRate: number;
  outcomes: SacBuntOutcome[];
}

export interface StolenBaseOutcome {
  opponent: string;
  url: string;
  inning: string;
  runnerName: string;
  stolenTo: 'second' | 'third' | 'home';
  eventuallyScored: boolean;
  playText: string;
}

export interface StolenBaseSummary {
  totalStolenBases: number;
  byBase: {
    base: 'second' | 'third' | 'home';
    total: number;
    scored: number;
  }[];
  overallScoringRate: number;
  outcomes: StolenBaseOutcome[];
}

export interface RunnerConversionRow {
  situation: BaseSituation;
  totalRunners: number;
  runnersScored: number;
  byOuts: { outs: number; totalRunners: number; runnersScored: number }[];
}
