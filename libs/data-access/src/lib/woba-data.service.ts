import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';

import type { YearBattingData } from './batting-types';
import { DataContextService } from './data-context.service';
import { resolveYearBattingData } from './data-resolve';
import { SoftballDataService } from './softball-data.service';

const CURRENT_YEAR = new Date().getFullYear();
const RESOLVE_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

/**
 * @deprecated Use SoftballDataService.getWellesleyBattingData() instead.
 * Kept temporarily for backward compatibility.
 */
@Injectable({
  providedIn: 'root',
})
export class WobaDataService {
  private readonly context = inject(DataContextService);
  private readonly dataService = inject(SoftballDataService);

  getSeasonData(year: number): Observable<YearBattingData> {
    return from(this.fetchResolvedData(year));
  }

  private async fetchResolvedData(year: number): Promise<YearBattingData> {
    const data = await this.fetchStaticJson(year);

    if (!this.context.isVerified() && RESOLVE_YEARS.includes(year)) {
      const games = await this.dataService.fetchGameDataCached(year);

      return resolveYearBattingData(data, games, year);
    }

    return data;
  }

  private async fetchStaticJson(year: number): Promise<YearBattingData> {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const file =
      year === CURRENT_YEAR
        ? 'data/batting-stats.json'
        : `data/batting-stats-${year}.json`;
    const url = `${base}${file}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as YearBattingData;
  }
}
