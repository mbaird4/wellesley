import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';

import { DataContextService } from './data-context.service';
import { resolveGameData, resolveRoster } from './data-resolve';
import type { OpponentRoster } from './opponent-types';

export interface GameData {
  url?: string;
  opponent?: string;
  lineup: Map<number, string[]>; // slot -> array of normalized names
  playByPlay: PlayByPlayInning[];
}

export interface PlayByPlayInning {
  inning: string; // e.g., "1st", "2nd", etc.
  plays: string[]; // Array of play description texts
}

export type JerseyMap = Record<string, number>;

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

  getOpponentGameData(slug: string, year: number): Observable<GameData[]> {
    const file =
      year === CURRENT_YEAR
        ? `data/opponents/${slug}/gamedata.json`
        : `data/opponents/${slug}/gamedata-${year}.json`;

    return from(this.fetchGameJson(file));
  }

  getRoster(): Observable<JerseyMap> {
    return from(this.fetchResolvedRoster());
  }

  getOpponentRoster(slug: string): Observable<OpponentRoster> {
    return from(
      this.fetchJson<OpponentRoster>(`data/opponents/${slug}/roster.json`)
    );
  }

  /** Cached game data fetch — used by both getGameData and getRoster. */
  fetchGameDataCached(year: number): Promise<GameData[]> {
    let cached = this.gameDataCache.get(year);

    if (!cached) {
      cached = this.fetchGameJson(dataPath('gamedata', year)).then(
        (games) => {
          if (!this.context.isVerified() && RESOLVE_YEARS.includes(year)) {
            return resolveGameData(games, year);
          }

          return games;
        }
      );
      this.gameDataCache.set(year, cached);
    }

    return cached;
  }

  private async fetchResolvedRoster(): Promise<JerseyMap> {
    const roster = await this.fetchJson<JerseyMap>('data/roster.json');

    if (!this.context.isVerified()) {
      // Use the most recent year with data for the roster mapping
      const year = RESOLVE_YEARS[RESOLVE_YEARS.length - 1];
      const games = await this.fetchGameDataCached(year);

      return resolveRoster(roster, games, year);
    }

    return roster;
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
}
