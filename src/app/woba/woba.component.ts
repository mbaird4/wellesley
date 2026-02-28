import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WobaDataService } from './woba-data.service';
import {
  PlayerWoba,
  PlayerCumulativeWoba,
  WobaSeasonData,
} from '../../lib/types';
import {
  computePlayerSeasonWobas,
  computePlayerCumulativeWobas,
  getWobaTier,
} from '../../lib/woba';

export interface TeamGameColumn {
  date: string;
  opponent: string;
}

export interface TeamGameCell {
  gameWoba: number;
  cumulativeWoba: number;
}

export interface TeamPlayerRow {
  name: string;
  seasonWoba: number;
  seasonTier: string;
  games: (TeamGameCell | null)[];
}

@Component({
  selector: 'app-woba',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './woba.component.html',
})
export class WobaComponent {
  private wobaData = inject(WobaDataService);
  private cdr = inject(ChangeDetectorRef);
  readonly isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  loading = false;
  error: string | null = null;
  selectedYear = 2025;
  availableYears = [2025, 2024, 2023, 2022, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011];
  activeTab: 'players' | 'team' = 'players';

  playerWobas: PlayerWoba[] = [];
  cumulativeWobas: PlayerCumulativeWoba[] = [];
  expandedPlayer: string | null = null;

  teamGameColumns: TeamGameColumn[] = [];
  teamPlayerRows: TeamPlayerRow[] = [];
  teamSortKey: 'name' | 'season' = 'season';
  teamSortDir: 'asc' | 'desc' = 'desc';

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.playerWobas = [];
    this.cumulativeWobas = [];
    this.expandedPlayer = null;
    this.teamGameColumns = [];
    this.teamPlayerRows = [];

    this.wobaData.getSeasonData(this.selectedYear).subscribe({
      next: (data) => {
        this.playerWobas = computePlayerSeasonWobas(data.seasonStats);
        this.cumulativeWobas = computePlayerCumulativeWobas(data.boxscores);
        this.buildTeamGrid();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.message || 'An error occurred while loading wOBA data';
        this.loading = false;
        console.error('Error loading wOBA data:', err);
        this.cdr.markForCheck();
      },
    });
  }

  reload(): void {
    this.wobaData.clearCache(this.selectedYear);
    this.loadData();
  }

  togglePlayer(name: string): void {
    this.expandedPlayer = this.expandedPlayer === name ? null : name;
  }

  getCumulativeForPlayer(name: string): PlayerCumulativeWoba | undefined {
    return this.cumulativeWobas.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
  }

  tierClass(tier: string): string {
    return `tier-${tier}`;
  }

  formatWoba(value: number): string {
    return value.toFixed(3).replace(/^0/, '');
  }

  getWobaTier = getWobaTier;

  sortTeamGrid(key: 'name' | 'season'): void {
    if (this.teamSortKey === key) {
      this.teamSortDir = this.teamSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.teamSortKey = key;
      this.teamSortDir = key === 'season' ? 'desc' : 'asc';
    }
    this.applySortTeamGrid();
  }

  private applySortTeamGrid(): void {
    const dir = this.teamSortDir === 'asc' ? 1 : -1;
    this.teamPlayerRows = [...this.teamPlayerRows].sort((a, b) => {
      if (this.teamSortKey === 'name') {
        return dir * a.name.localeCompare(b.name);
      }
      return dir * (a.seasonWoba - b.seasonWoba);
    });
  }

  private buildTeamGrid(): void {
    // Build unique ordered game list from cumulative data
    const gameKeys = new Map<string, TeamGameColumn>();
    for (const player of this.cumulativeWobas) {
      for (const g of player.games) {
        const key = `${g.date}|${g.opponent}`;
        if (!gameKeys.has(key)) {
          gameKeys.set(key, { date: g.date, opponent: g.opponent });
        }
      }
    }
    this.teamGameColumns = Array.from(gameKeys.values());

    // Build a lookup: player -> game key -> { gameWoba, cumulativeWoba }
    this.teamPlayerRows = this.cumulativeWobas.map(player => {
      const gameMap = new Map<string, TeamGameCell>();
      for (const g of player.games) {
        gameMap.set(`${g.date}|${g.opponent}`, {
          gameWoba: g.gameWoba,
          cumulativeWoba: g.cumulativeWoba,
        });
      }

      const seasonPlayer = this.playerWobas.find(
        p => p.name.toLowerCase() === player.name.toLowerCase()
      );

      return {
        name: player.name,
        seasonWoba: seasonPlayer?.woba ?? 0,
        seasonTier: seasonPlayer?.tier ?? 'below_average',
        games: this.teamGameColumns.map(col => {
          const key = `${col.date}|${col.opponent}`;
          return gameMap.get(key) ?? null;
        }),
      };
    });
    this.applySortTeamGrid();
  }
}
