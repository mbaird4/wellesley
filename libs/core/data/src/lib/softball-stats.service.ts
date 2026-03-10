import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { forkJoin, map } from 'rxjs';

import { SoftballDataService } from './softball-data.service';
import type { ProcessedStatsWithSnapshots } from './softball-processor.service';
import { SoftballProcessorService } from './softball-processor.service';

export type StatsWithTimestamp = ProcessedStatsWithSnapshots & {
  scrapedAt: string;
};

@Injectable({
  providedIn: 'root',
})
export class SoftballStatsService {
  private readonly dataService = inject(SoftballDataService);
  private readonly processorService = inject(SoftballProcessorService);

  getStats(year: number): Observable<StatsWithTimestamp> {
    return forkJoin({
      games: this.dataService.getGameData(year),
      scrapedAt: this.dataService.getScrapedAt(year),
    }).pipe(
      map(({ games, scrapedAt }) => ({
        ...this.processorService.processGamesWithSnapshots(games),
        scrapedAt,
      }))
    );
  }
}
