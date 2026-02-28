import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { SoftballDataService } from './softball-data.service';
import {
  ProcessedStatsWithSnapshots,
  SoftballProcessorService,
} from './softball-processor.service';

export type { ProcessedStatsWithSnapshots } from './softball-processor.service';
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
export class SoftballStatsService {
  private readonly dataService = inject(SoftballDataService);
  private readonly processorService = inject(SoftballProcessorService);

  getStats(year: number): Observable<ProcessedStatsWithSnapshots> {
    return this.dataService
      .getGameData(year)
      .pipe(
        map((games) => this.processorService.processGamesWithSnapshots(games))
      );
  }
}
