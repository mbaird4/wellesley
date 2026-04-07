import { inject, Injectable } from '@angular/core';
import type { GameData, NextOpponentMeta, PlayByPlayInning, Roster, SeasonStatsData, YearBattingData, YearPitchingData } from '@ws/core/models';
import { getBaseHref } from '@ws/core/util';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';

import { DataContextService } from './data-context.service';
import { resolveGameData, resolveYearBattingData } from './data-resolve';

export type { GameData, PlayByPlayInning };

// JerseyMap is exported from batting-types.ts

const CURRENT_YEAR = new Date().getFullYear();
const RESOLVE_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

function dataPath(base: string, year: number): string {
  return year === CURRENT_YEAR ? `data/${base}.json` : `data/${base}-${year}.json`;
}

function opponentDataPath(dataDir: string, base: string, year: number): string {
  return year === CURRENT_YEAR ? `data/opponents/${dataDir}/${base}.json` : `data/opponents/${dataDir}/${base}-${year}.json`;
}

@Injectable({
  providedIn: 'root',
})
export class SoftballDataService {
  private readonly context = inject(DataContextService);
  private readonly gameDataCache = new Map<number, Promise<GameData[]>>();
  private readonly metaCache = new Map<string, Promise<NextOpponentMeta>>();

  getGameData(year: number): Observable<GameData[]> {
    return from(this.fetchGameDataCached(year));
  }

  getOpponentGameData(dataDir: string, year: number): Observable<GameData[]> {
    const file = year === CURRENT_YEAR ? `data/opponents/${dataDir}/gamedata.json` : `data/opponents/${dataDir}/gamedata-${year}.json`;

    return from(this.fetchGameJson(file));
  }

  getOpponentRoster(dataDir: string): Observable<Roster> {
    return from(this.fetchJson<Roster>(`data/opponents/${dataDir}/roster.json`));
  }

  getOpponentBattingData(dataDir: string, year: number): Observable<YearBattingData> {
    return from(this.fetchJson<YearBattingData>(opponentDataPath(dataDir, 'batting-stats', year)));
  }

  getOpponentPitchingData(dataDir: string, year: number): Observable<YearPitchingData> {
    return from(this.fetchJson<YearPitchingData>(opponentDataPath(dataDir, 'pitching', year)));
  }

  getOpponentSeasonStats(dataDir: string): Observable<SeasonStatsData> {
    return from(this.fetchJson<SeasonStatsData>(`data/opponents/${dataDir}/season-stats.json`));
  }

  getOpponentMeta(dataDir: string): Observable<NextOpponentMeta> {
    let cached = this.metaCache.get(dataDir);

    if (!cached) {
      cached = this.fetchJson<NextOpponentMeta>(`data/opponents/${dataDir}/meta.json`);
      this.metaCache.set(dataDir, cached);
    }

    return from(cached);
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

  /** Cached game data fetch — used by both getGameData and RosterService. */
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

  private async fetchResolvedBattingData(year: number): Promise<YearBattingData> {
    const data = await this.fetchJson<YearBattingData>(dataPath('batting-stats', year));

    if (!this.context.isVerified() && RESOLVE_YEARS.includes(year)) {
      const games = await this.fetchGameDataCached(year);

      return resolveYearBattingData(data, games, year);
    }

    return data;
  }

  async fetchJson<T>(path: string): Promise<T> {
    const base = getBaseHref();
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
        date?: string;
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
