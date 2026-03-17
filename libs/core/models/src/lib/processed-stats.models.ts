import type { ClutchSummary } from './clutch.models';
import type { GameResult, ResultRow } from './game.models';
import type { PlayerLineupBreakdown } from './lineup-position.models';
import type { GameScoringPlays, RunnerConversionRow, SacBuntSummary, ScoringPlaySummary, StolenBaseSummary } from './scoring.models';
import type { BaseRunnerRow, GameWithSnapshots } from './snapshot.models';

export interface ProcessedStats {
  totals: ResultRow[];
  games: GameResult[];
}

export interface ProcessedStatsWithSnapshots {
  totals: ResultRow[];
  games: GameWithSnapshots[];
  baseRunnerStats: BaseRunnerRow[];
  baseRunnerStatsAtBatStart: BaseRunnerRow[];
  seasonScoringPlays: ScoringPlaySummary;
  gameScoringPlays: GameScoringPlays[];
  sacBuntSummary: SacBuntSummary;
  stolenBaseSummary: StolenBaseSummary;
  runnerConversions: RunnerConversionRow[];
  clutchSummary: ClutchSummary;
  playerLineupStats: PlayerLineupBreakdown[];
}
