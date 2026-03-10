import type { BaseRunners, GameResult } from './game.models';
import type { ScoringPlay } from './scoring.models';

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

export type BaseSituation = 'empty' | 'first' | 'second' | 'third' | 'first_second' | 'first_third' | 'second_third' | 'loaded';

/** [0-out count, 1-out count, 2-out count] */
export type OutBreakdown = [number, number, number];

export interface BaseRunnerRow {
  lineupSlot: number;
  situations: Record<BaseSituation, OutBreakdown>;
}

export type BaseRunnerMode = 'at-bat-start' | 'ball-in-play';

export interface GameWithSnapshots extends GameResult {
  snapshots: PlaySnapshot[];
  baseRunnerStats: BaseRunnerRow[];
  baseRunnerStatsAtBatStart: BaseRunnerRow[];
}
