import { Injectable } from '@angular/core';
import { GameData } from './softball-data.service';
import { processGames, ProcessedStats, processGamesWithSnapshots, ProcessedStatsWithSnapshots } from '@ws/stats-core';

export type { ProcessedStats, ProcessedStatsWithSnapshots } from '@ws/stats-core';
export type { ResultRow, GameResult, GameWithSnapshots, BaseRunnerRow, BaseSituation, ScoringPlay, ScoringPlayType, ScoringPlaySummary, GameScoringPlays, SacBuntOutcome, SacBuntSummary } from '@ws/stats-core';

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
