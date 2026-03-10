import { inject, Injectable } from '@angular/core';
import type { GameData, PlayByPlayInning, Roster, YearBattingData, YearPitchingData } from '@ws/core/models';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';

import { DataContextService } from './data-context.service';
import { resolveGameData, resolveRoster, resolveYearBattingData } from './data-resolve';

export type { GameData, PlayByPlayInning };

// JerseyMap is exported from batting-types.ts

const CURRENT_YEAR = new Date().getFullYear();
const RESOLVE_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

function dataPath(base: string, year: number): string {
  return year === CURRENT_YEAR ? `data/${base}.json` : `data/${base}-${year}.json`;
}

@Injectable({
  providedIn: 'root',
})
export class SoftballDataService {
  private readonly context = inject(DataContextService);
  private readonly gameDataCache = new Map<number, Promise<GameData[]>>();

  getGameData(year: number): Observable<GameData[]> {
    return from(this.fetchGameDataCached(year));
  }

  getOpponentGameData(dataDir: string, year: number): Observable<GameData[]> {
    const file = year === CURRENT_YEAR ? `data/opponents/${dataDir}/gamedata.json` : `data/opponents/${dataDir}/gamedata-${year}.json`;

    return from(this.fetchGameJson(file));
  }

  getRoster(): Observable<Roster> {
    return from(this.fetchResolvedRoster());
  }

  getOpponentRoster(dataDir: string): Observable<Roster> {
    return from(this.fetchJson<Roster>(`data/opponents/${dataDir}/roster.json`));
  }

  getWellesleyPitchingData(year: number): Observable<YearPitchingData> {
    return from(this.fetchJson<YearPitchingData>(dataPath('pitching', year)));
  }

  getWellesleyBattingData(year: number): Observable<YearBattingData> {
    return from(this.fetchResolvedBattingData(year));
  }

  getScrapedAt(year: number): Observable<string> {
    return from(
      this.fetchJson<{ scrapedAt: string }>(dataPath('batting-stats', year))
        .then((d) => d.scrapedAt ?? '')
        .catch(() => '')
    );
  }

  /** Cached game data fetch — used by both getGameData and getRoster. */
  fetchGameDataCached(year: number): Promise<GameData[]> {
    let cached = this.gameDataCache.get(year);

    if (!cached) {
      cached = this.fetchGameJson(dataPath('gamedata', year)).then((games) => {
        if (!this.context.isVerified() && RESOLVE_YEARS.includes(year)) {
          return resolveGameData(games, year);
        }

        return games;
      });
      this.gameDataCache.set(year, cached);
    }

    return cached;
  }

  private async fetchResolvedRoster(): Promise<Roster> {
    const roster = await this.fetchJson<Roster>('data/roster.json');

    if (!this.context.isVerified()) {
      // Use the most recent year with data for the roster mapping
      const year = RESOLVE_YEARS[RESOLVE_YEARS.length - 1];
      const games = await this.fetchGameDataCached(year);

      return resolveRoster(roster, games, year);
    }

    return roster;
  }

  private async fetchResolvedBattingData(year: number): Promise<YearBattingData> {
    const data = await this.fetchJson<YearBattingData>(dataPath('batting-stats', year));

    if (!this.context.isVerified() && RESOLVE_YEARS.includes(year)) {
      const games = await this.fetchGameDataCached(year);

      return resolveYearBattingData(data, games, year);
    }

    return data;
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const url = `${base}${path}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private async fetchGameJson(path: string): Promise<GameData[]> {
    const parsed = await this.fetchJson<
      Array<{
        url?: string;
        opponent?: string;
        lineup: [number, string[]][];
        playByPlay: PlayByPlayInning[];
      }>
    >(path);

    return parsed.map((g) => ({
      ...g,
      lineup: new Map(g.lineup),
    }));
  }

  public getCurrentCareerSpan() {
    return RESOLVE_YEARS;
  }
}
