import type { BatterResult } from './batter-result.models';
import type { BaseSituation } from './snapshot.models';

/** A single PA with runners on base */
export interface ClutchEvent {
  opponent: string;
  url: string;
  inning: string;
  outsBefore: number;
  baseSituation: BaseSituation;
  batterName: string;
  lineupSlot: number;
  batterResult: BatterResult;
  isPinchHit: boolean;
  playText: string;
  runnersOn: RunnerOutcome[];
  runnersScored: number;
  runnersAdvanced: number;
  runnersStranded: number;
}

export interface RunnerOutcome {
  name: string;
  baseBefore: 'first' | 'second' | 'third';
  outcome: 'scored' | 'advanced' | 'stranded' | 'out';
}

/** Accumulated batting stats for wOBA calculation from play-by-play */
export interface PbpBattingAccum {
  pa: number;
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

/** Per-player clutch summary */
export interface PlayerClutchSummary {
  name: string;
  runnersOnWoba: number;
  basesEmptyWoba: number;
  rispWoba: number;
  overallWoba: number;
  wobaDelta: number;
  runnersOnPa: number;
  totalRunnersOn: number;
  runnersDrivenIn: number;
  runnersAdvanced: number;
  runnersStranded: number;
  byOuts: { outs: number; lob: number; drivenIn: number; pa: number }[];
  games: PlayerClutchGame[];
  events: ClutchEvent[];
  runnersOnStats: PbpBattingAccum;
  basesEmptyStats: PbpBattingAccum;
  rispStats: PbpBattingAccum;
  overallStats: PbpBattingAccum;
  basesEmptyProductive: number;
  basesEmptyTotal: number;
  overallProductive: number;
  overallProductiveTotal: number;
}

/** Per-game clutch breakdown for a single player */
export interface PlayerClutchGame {
  opponent: string;
  url: string;
  runnersOnPa: number;
  drivenIn: number;
  stranded: number;
  events: ClutchEvent[];
}

/** Top-level season clutch data */
export interface ClutchSummary {
  players: PlayerClutchSummary[];
  allEvents: ClutchEvent[];
}

export type BattingMetric = 'woba' | 'avg';
