import { Injectable } from '@angular/core';
import { GameData } from './softball-data.service';
import { processGames, ProcessedStats, processGamesWithSnapshots, ProcessedStatsWithSnapshots } from '../lib/process-games';

export type { ProcessedStats, ProcessedStatsWithSnapshots } from '../lib/process-games';
export type { ResultRow, GameResult, GameWithSnapshots, BaseRunnerRow, BaseSituation, ScoringPlay, ScoringPlayType, ScoringPlaySummary, GameScoringPlays, SacBuntOutcome, SacBuntSummary } from '../lib/types';

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
