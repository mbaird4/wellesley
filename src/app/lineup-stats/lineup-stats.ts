import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { SoftballStatsService } from '@ws/core/data';
import type { BaseRunnerMode, BaseRunnerRow, GameWithSnapshots, PlayerLineupBreakdown, ResultRow } from '@ws/core/models';
import { BaseRunnerTable, EmptyState, ErrorBanner, GameViewer, LoadingState, SeasonPicker } from '@ws/core/ui';
import { ALL_SEASON_YEARS, CURRENT_YEAR } from '@ws/core/util';

import { PlayerLineupTable } from './player-lineup-table/player-lineup-table';

@Component({
  selector: 'ws-lineup-stats',
  standalone: true,
  imports: [
    BaseRunnerTable,
    CommonModule,
    EmptyState,
    ErrorBanner,
    GameViewer,
    LoadingState,
    PlayerLineupTable,
    SeasonPicker,
  ],
  templateUrl: './lineup-stats.html',
  host: { class: 'block stats-section' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineupStats {
  private statsService = inject(SoftballStatsService);
  private cdr = inject(ChangeDetectorRef);

  results: ResultRow[] = [];
  games: GameWithSnapshots[] = [];
  baseRunnerStats: BaseRunnerRow[] = [];
  baseRunnerStatsAtBatStart: BaseRunnerRow[] = [];
  playerLineupStats: PlayerLineupBreakdown[] = [];
  expandedGame: number | null = null;
  loading = false;
  error: string | null = null;
  scrapedAt: string | null = null;
  totalPlateAppearances = 0;
  selectedYear = CURRENT_YEAR;
  availableYears = ALL_SEASON_YEARS;

  readonly baseRunnerMode = signal<BaseRunnerMode>('at-bat-start');

  constructor() {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.error = null;
    this.results = [];
    this.games = [];
    this.baseRunnerStats = [];
    this.baseRunnerStatsAtBatStart = [];
    this.playerLineupStats = [];
    this.expandedGame = null;
    this.scrapedAt = null;
    this.totalPlateAppearances = 0;

    this.statsService.getStats(this.selectedYear).subscribe({
      next: (stats) => {
        this.scrapedAt = stats.scrapedAt || null;
        this.results = stats.totals;
        this.games = stats.games;
        this.baseRunnerStats = stats.baseRunnerStats;
        this.baseRunnerStatsAtBatStart = stats.baseRunnerStatsAtBatStart;
        this.playerLineupStats = stats.playerLineupStats;
        this.totalPlateAppearances = stats.totals.reduce((sum, r) => sum + r.totalPA, 0);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.message || 'An error occurred while loading stats';
        this.loading = false;
        console.error('Error loading stats:', err);
        this.cdr.markForCheck();
      },
    });
  }

  setYear(year: number): void {
    this.selectedYear = year;
    this.loadStats();
  }

  toggleGame(index: number): void {
    this.expandedGame = this.expandedGame === index ? null : index;
  }

  boxscoreUrl(game: GameWithSnapshots): string {
    return game.url.replace(/^\/wellesleyblue/, 'https://wellesleyblue.com');
  }
}
