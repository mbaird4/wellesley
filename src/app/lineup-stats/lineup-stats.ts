import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SoftballStatsService } from '@ws/core/data';
import type { BaseRunnerMode, BaseRunnerRow, GameWithSnapshots, ResultRow } from '@ws/core/models';
import { BaseRunnerTable, GameViewer, LastUpdatedPipe } from '@ws/core/ui';

@Component({
  selector: 'ws-lineup-stats',
  standalone: true,
  imports: [
    BaseRunnerTable,
    CommonModule,
    FormsModule,
    GameViewer,
    LastUpdatedPipe,
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
  expandedGame: number | null = null;
  loading = false;
  error: string | null = null;
  scrapedAt: string | null = null;
  totalPlateAppearances = 0;
  selectedYear = 2025;
  availableYears: number[] = [];

  readonly baseRunnerMode = signal<BaseRunnerMode>('at-bat-start');

  constructor() {
    const currentYear = new Date().getFullYear();
    this.availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.error = null;
    this.results = [];
    this.games = [];
    this.baseRunnerStats = [];
    this.baseRunnerStatsAtBatStart = [];
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

  toggleGame(index: number): void {
    this.expandedGame = this.expandedGame === index ? null : index;
  }

  boxscoreUrl(game: GameWithSnapshots): string {
    return game.url.replace(/^\/wellesleyblue/, 'https://wellesleyblue.com');
  }
}
