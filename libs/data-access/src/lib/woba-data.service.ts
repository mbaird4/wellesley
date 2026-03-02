import { inject, Injectable } from '@angular/core';
import type { WobaSeasonData } from '@ws/stats-core';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';

import { DataContextService } from './data-context.service';
import { resolveWobaData } from './data-resolve';
import { SoftballDataService } from './softball-data.service';

const RESOLVE_YEARS = [2023, 2024, 2025, 2026];

@Injectable({
  providedIn: 'root',
})
export class WobaDataService {
  private readonly context = inject(DataContextService);
  private readonly dataService = inject(SoftballDataService);

  getSeasonData(year: number): Observable<WobaSeasonData> {
    return from(this.fetchResolvedData(year));
  }

  private async fetchResolvedData(year: number): Promise<WobaSeasonData> {
    const data = await this.fetchStaticJson(year);

    if (!this.context.isVerified() && RESOLVE_YEARS.includes(year)) {
      const games = await this.dataService.fetchGameDataCached(year);

      return resolveWobaData(data, games, year);
    }

    return data;
  }

  private async fetchStaticJson(year: number): Promise<WobaSeasonData> {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const url = `${base}data/wobadata-${year}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as WobaSeasonData;
  }
}
