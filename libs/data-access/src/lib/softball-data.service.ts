import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class SoftballDataService {
  getGameData(year: number): Observable<GameData[]> {
    return from(this.fetchStaticJson(year));
  }

  private async fetchStaticJson(year: number): Promise<GameData[]> {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const url = `${base}data/gamedata-${year}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json() as Array<{
      url?: string;
      opponent?: string;
      lineup: [number, string[]][];
      playByPlay: PlayByPlayInning[];
    }>;
    return parsed.map(g => ({
      ...g,
      lineup: new Map(g.lineup),
    }));
  }
}
