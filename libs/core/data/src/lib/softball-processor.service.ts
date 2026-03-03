import { Injectable } from '@angular/core';
import type {
  ProcessedStats,
  ProcessedStatsWithSnapshots,
} from '@ws/core/processors';
import { processGames, processGamesWithSnapshots } from '@ws/core/processors';

import type { GameData } from './softball-data.service';

export type {
  ProcessedStats,
  ProcessedStatsWithSnapshots,
} from '@ws/core/processors';

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
