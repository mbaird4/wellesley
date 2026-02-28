import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { WobaSeasonData } from '../../lib/types';

@Injectable({
  providedIn: 'root',
})
export class WobaDataService {
  getSeasonData(year: number): Observable<WobaSeasonData> {
    return from(this.fetchStaticJson(year));
  }

  private async fetchStaticJson(year: number): Promise<WobaSeasonData> {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const url = `${base}data/wobadata-${year}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as WobaSeasonData;
  }
}
