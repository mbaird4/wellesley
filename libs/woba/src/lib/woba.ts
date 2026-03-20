import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { RosterService, SoftballDataService } from '@ws/core/data';
import type { PlayerCumulativeWoba, PlayerWoba } from '@ws/core/models';
import { computePlayerCumulativeWobas, computePlayerSeasonWobas, formatWoba, getWobaTier, tierClass, wobaGradientStyle } from '@ws/core/processors';
import { ButtonToggle, EmptyState, ErrorBanner, FormatWobaPipe, LastUpdatedPipe, LoadingState, type ToggleOption, WobaLegend } from '@ws/core/ui';
import { ALL_SEASON_YEARS, CURRENT_YEAR } from '@ws/core/util';

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
  selector: 'ws-woba',
  standalone: true,
  imports: [
    CommonModule,
    ButtonToggle,
    EmptyState,
    ErrorBanner,
    FormatWobaPipe,
    LastUpdatedPipe,
    LoadingState,
    WobaLegend,
  ],
  host: {
    class: 'block stats-section',
  },
  templateUrl: './woba.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Woba {
  private dataService = inject(SoftballDataService);
  private rosterService = inject(RosterService);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  error: string | null = null;
  scrapedAt: string | null = null;
  teamGames = 0;
  selectedYear = CURRENT_YEAR;
  selectedYearStr = String(this.selectedYear);
  yearOptions: ToggleOption[] = ALL_SEASON_YEARS.map((y) => ({
    value: String(y),
    label: String(y),
  }));

  activeTab: 'players' | 'team' = 'team';

  playerWobas: PlayerWoba[] = [];
  cumulativeWobas: PlayerCumulativeWoba[] = [];
  cumulativeByName = new Map<string, PlayerCumulativeWoba>();
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
    this.cumulativeByName = new Map();
    this.expandedPlayer = null;
    this.scrapedAt = null;
    this.teamGames = 0;
    this.teamGameColumns = [];
    this.teamPlayerRows = [];

    this.dataService.getWellesleyBattingData(this.selectedYear).subscribe({
      next: (data) => {
        this.scrapedAt = data.scrapedAt ?? null;
        this.teamGames = data.teamGames ?? 0;
        const rosterNames = this.rosterService.wellesleyRosterNames();
        const onRoster = (name: string) => rosterNames.size === 0 || rosterNames.has(name.toLowerCase());
        const seasonStats = data.players.filter((p) => onRoster(p.name)).map((p) => p.season);
        const boxscores = (data.boxscores ?? []).map((bs) => ({
          ...bs,
          playerStats: bs.playerStats.filter((ps) => onRoster(ps.name)),
        }));
        this.playerWobas = computePlayerSeasonWobas(seasonStats);
        this.cumulativeWobas = computePlayerCumulativeWobas(boxscores).filter((c) => onRoster(c.name));
        this.cumulativeByName = new Map(this.cumulativeWobas.map((c) => [c.name.toLowerCase(), c]));
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

  onYearChange(value: string | string[]): void {
    this.selectedYear = Number(value);
    this.selectedYearStr = String(this.selectedYear);
    this.loadData();
  }

  togglePlayer(name: string): void {
    this.expandedPlayer = this.expandedPlayer === name ? null : name;
  }

  get minPa(): number {
    return this.teamGames * 2;
  }

  get qualifiedPlayers(): PlayerWoba[] {
    return this.playerWobas.filter((p) => p.pa >= this.minPa);
  }

  get unqualifiedPlayers(): PlayerWoba[] {
    return this.playerWobas.filter((p) => p.pa < this.minPa);
  }

  get qualifiedTeamRows(): TeamPlayerRow[] {
    return this.teamPlayerRows.filter((r) => {
      const pw = this.playerWobas.find((p) => p.name.toLowerCase() === r.name.toLowerCase());

      return pw ? pw.pa >= this.minPa : false;
    });
  }

  get unqualifiedTeamRows(): TeamPlayerRow[] {
    return this.teamPlayerRows.filter((r) => {
      const pw = this.playerWobas.find((p) => p.name.toLowerCase() === r.name.toLowerCase());

      return pw ? pw.pa < this.minPa : true;
    });
  }

  tierClass = tierClass;
  formatWoba = formatWoba;
  getWobaTier = getWobaTier;
  wobaGradientStyle = wobaGradientStyle;

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
    this.cumulativeWobas.forEach((player) => {
      player.games.forEach((g) => {
        const key = `${g.date}|${g.opponent}`;

        if (!gameKeys.has(key)) {
          gameKeys.set(key, { date: g.date, opponent: g.opponent });
        }
      });
    });

    this.teamGameColumns = Array.from(gameKeys.values());

    // Build a lookup: player -> game key -> { gameWoba, cumulativeWoba }
    this.teamPlayerRows = this.cumulativeWobas.map((player) => {
      const gameMap = new Map(player.games.map((g) => [`${g.date}|${g.opponent}`, { gameWoba: g.gameWoba, cumulativeWoba: g.cumulativeWoba }]));

      const seasonPlayer = this.playerWobas.find((p) => p.name.toLowerCase() === player.name.toLowerCase());

      return {
        name: player.name,
        seasonWoba: seasonPlayer?.woba ?? 0,
        seasonTier: seasonPlayer?.tier ?? 'below_average',
        games: this.teamGameColumns.map((col) => {
          const key = `${col.date}|${col.opponent}`;

          return gameMap.get(key) ?? null;
        }),
      };
    });
    this.applySortTeamGrid();
  }
}
