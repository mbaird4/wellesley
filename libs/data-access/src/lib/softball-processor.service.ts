import { Injectable } from '@angular/core';
import {
  ProcessedStats,
  ProcessedStatsWithSnapshots,
  processGames,
  processGamesWithSnapshots,
} from '@ws/stats-core';

import { GameData } from './softball-data.service';

export type {
  ProcessedStats,
  ProcessedStatsWithSnapshots,
} from '@ws/stats-core';
export type {
  BaseRunnerRow,
  BaseSituation,
  GameResult,
  GameScoringPlays,
  GameWithSnapshots,
  ResultRow,
  SacBuntOutcome,
  SacBuntSummary,
  ScoringPlay,
  ScoringPlaySummary,
  ScoringPlayType,
} from '@ws/stats-core';

@Injectable({
  providedIn: 'root',
})
export class SoftballProcessorService {
  processGames(games: GameData[]): ProcessedStats {
    return processGames(games);
  }

  processGamesWithSnapshots(games: GameData[]): ProcessedStatsWithSnapshots {
    return processGamesWithSnapshots(games);
  }
}
