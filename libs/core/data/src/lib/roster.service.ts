import { computed, inject, Injectable, signal } from '@angular/core';
import type { Roster } from '@ws/core/models';
import { toJerseyMap } from '@ws/core/models';

import { DataContextService } from './data-context.service';
import { resolveRoster } from './data-resolve';
import { SoftballDataService } from './softball-data.service';

@Injectable({
  providedIn: 'root',
})
export class RosterService {
  private readonly context = inject(DataContextService);
  private readonly dataService = inject(SoftballDataService);

  private readonly _wellesleyRoster = signal<Roster | null>(null);
  private readonly opponentCache = new Map<string, Promise<Roster>>();

  readonly wellesleyRoster = this._wellesleyRoster.asReadonly();

  readonly wellesleyJerseyMap = computed(() => {
    const roster = this._wellesleyRoster();

    return roster ? toJerseyMap(roster) : null;
  });

  readonly wellesleyRosterNames = computed(() => {
    const roster = this._wellesleyRoster();

    return roster ? new Set(Object.keys(roster)) : new Set<string>();
  });

  /** Abbreviated names ("F. Last") derived from roster keys ("last, first") for play-by-play matching. */
  readonly wellesleyRosterAbbrevNames = computed(() => {
    const roster = this._wellesleyRoster();

    if (!roster) {
      return new Set<string>();
    }

    return new Set(Object.keys(roster).map((key) => this.abbreviateName(key)));
  });

  /** Convert "last, first" → "F. Last" display format. */
  abbreviateName(key: string): string {
    const [last, first] = key.split(', ');

    return `${(first?.[0] ?? '').toUpperCase()}. ${last.charAt(0).toUpperCase()}${last.slice(1)}`;
  }

  async loadWellesleyRoster(): Promise<void> {
    const roster = await this.dataService.fetchJson<Roster>('data/roster.json');

    if (!this.context.isVerified()) {
      const CURRENT_YEAR = new Date().getFullYear();
      const RESOLVE_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);
      const year = RESOLVE_YEARS[RESOLVE_YEARS.length - 1];
      const games = await this.dataService.fetchGameDataCached(year);

      this._wellesleyRoster.set(resolveRoster(roster, games, year));
    } else {
      this._wellesleyRoster.set(roster);
    }
  }

  loadOpponentRoster(dataDir: string): Promise<Roster> {
    let cached = this.opponentCache.get(dataDir);

    if (!cached) {
      cached = this.dataService.fetchJson<Roster>(`data/opponents/${dataDir}/roster.json`);
      this.opponentCache.set(dataDir, cached);
    }

    return cached;
  }
}
