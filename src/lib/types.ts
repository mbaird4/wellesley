export interface ResultRow {
  lineupSlot: number;
  paWith0Outs: number;
  paWith1Out: number;
  paWith2Outs: number;
  totalPA: number;
}

export interface BaseRunners {
  first: string | null;
  second: string | null;
  third: string | null;
}

export interface GameState {
  baseRunners: BaseRunners;
  outs: number;
  batterIndex: number; // persists across innings
  plateAppearances: Map<number, [number, number, number]>; // slot -> [0-out, 1-out, 2-out]
}

export interface GameData {
  url?: string; // boxscore URL for linking
  opponent?: string; // opponent name parsed from URL
  lineup: Map<number, string[]>; // slot -> array of normalized names
  playByPlay: PlayByPlayInning[];
}

export interface PlayByPlayInning {
  inning: string;
  plays: string[];
}

/** Per-game result for the debug/detail view */
export interface GameResult {
  url: string;
  opponent: string;
  rows: ResultRow[];
  totalPA: number;
}

// --- Scoring play types ---

export type ScoringPlayType =
  | 'homer' | 'triple' | 'double' | 'single' | 'bunt_single'
  | 'sac_fly' | 'sac_bunt' | 'walk' | 'hbp' | 'wild_pitch' | 'passed_ball'
  | 'stolen_base' | 'fielders_choice' | 'error' | 'productive_out' | 'unknown';

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

export interface PlaySnapshot {
  playIndex: number;
  inning: string;
  playText: string;
  playType: string;
  basesBefore: BaseRunners;
  outsBefore: number;
  basesAfter: BaseRunners;
  outsAfter: number;
  lineupSlot: number | null;
  batterName: string | null;
  isPlateAppearance: boolean;
  currentBatterName: string | null;
  currentBatterSlot: number;
  scoringPlays: ScoringPlay[];
}

export type BaseSituation = 'empty' | 'first' | 'second' | 'third'
  | 'first_second' | 'first_third' | 'second_third' | 'loaded';

/** [0-out count, 1-out count, 2-out count] */
export type OutBreakdown = [number, number, number];

export interface BaseRunnerRow {
  lineupSlot: number;
  situations: Record<BaseSituation, OutBreakdown>;
}

export interface GameWithSnapshots extends GameResult {
  snapshots: PlaySnapshot[];
  baseRunnerStats: BaseRunnerRow[];
}

// --- wOBA types ---

export type WobaTier = 'excellent' | 'great' | 'above_average' | 'average' | 'below_average';

/** Raw per-player season totals scraped from the stats page */
export interface PlayerSeasonStats {
  name: string;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  sf: number;
  sh: number;
}

/** Per-player stats from a single boxscore */
export interface PlayerGameStats {
  name: string;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  sf: number;
  sh: number;
}

/** Parsed data from a single boxscore */
export interface BoxscoreData {
  date: string;
  opponent: string;
  url: string;
  playerStats: PlayerGameStats[];
}

/** Computed season wOBA with components */
export interface PlayerWoba {
  name: string;
  pa: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  woba: number;
  tier: WobaTier;
}

/** Per-player running wOBA across games */
export interface PlayerCumulativeWoba {
  name: string;
  games: {
    date: string;
    opponent: string;
    gameWoba: number;
    cumulativeWoba: number;
    tier: WobaTier;
  }[];
}

/** Combined season data returned by woba data service */
export interface WobaSeasonData {
  seasonStats: PlayerSeasonStats[];
  boxscores: BoxscoreData[];
}
