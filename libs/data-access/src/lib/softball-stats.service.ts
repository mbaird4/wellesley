import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SoftballDataService } from './softball-data.service';
import {
  SoftballProcessorService,
  ProcessedStatsWithSnapshots,
} from './softball-processor.service';

export type { ProcessedStatsWithSnapshots } from './softball-processor.service';
export type { ResultRow, GameResult, GameWithSnapshots, BaseRunnerRow, BaseSituation, ScoringPlay, ScoringPlayType, ScoringPlaySummary, GameScoringPlays, SacBuntOutcome, SacBuntSummary } from '@ws/stats-core';

@Injectable({
  providedIn: 'root',
})
export class SoftballStatsService {
  private readonly dataService = inject(SoftballDataService);
  private readonly processorService = inject(SoftballProcessorService);

  getStats(year: number): Observable<ProcessedStatsWithSnapshots> {
    return this.dataService.getGameData(year).pipe(
      map(games => this.processorService.processGamesWithSnapshots(games))
    );
  }
}
