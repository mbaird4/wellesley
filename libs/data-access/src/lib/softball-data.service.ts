import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class SoftballDataService {
  getGameData(year: number): Observable<GameData[]> {
    return from(this.fetchGameJson(`data/gamedata-${year}.json`));
  }

  getOpponentGameData(slug: string, year: number): Observable<GameData[]> {
    return from(
      this.fetchGameJson(`data/opponents/${slug}-gamedata-${year}.json`)
    );
  }

  getRoster(): Observable<JerseyMap> {
    return from(this.fetchJson<JerseyMap>('data/roster.json'));
  }

  getOpponentRoster(slug: string): Observable<JerseyMap> {
    return from(
      this.fetchJson<JerseyMap>(`data/opponents/${slug}-roster.json`)
    );
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
