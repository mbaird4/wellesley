import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoftballStatsService, ResultRow, GameWithSnapshots, BaseRunnerRow, BaseSituation } from '../softball-stats.service';
import { GameViewer } from '../game-viewer/game-viewer';

@Component({
  selector: 'ws-lineup-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, GameViewer],
  templateUrl: './lineup-stats.html',
  host: { class: 'block stats-section' },
})
export class LineupStats {
  private statsService = inject(SoftballStatsService);
  private cdr = inject(ChangeDetectorRef);

  results: ResultRow[] = [];
  games: GameWithSnapshots[] = [];
  baseRunnerStats: BaseRunnerRow[] = [];
  expandedGame: number | null = null;
  loading = false;
  error: string | null = null;
  totalPlateAppearances = 0;
  selectedYear = 2025;
  availableYears: number[] = [];

  readonly situations: { key: BaseSituation; label: string }[] = [
    { key: 'empty', label: 'No one on' },
    { key: 'first', label: '1st' },
    { key: 'second', label: '2nd' },
    { key: 'third', label: '3rd' },
    { key: 'first_second', label: '1st & 2nd' },
    { key: 'first_third', label: '1st & 3rd' },
    { key: 'second_third', label: '2nd & 3rd' },
    { key: 'loaded', label: 'Loaded' },
  ];

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
    this.expandedGame = null;
    this.totalPlateAppearances = 0;

    this.statsService.getStats(this.selectedYear).subscribe({
      next: (stats) => {
        this.results = stats.totals;
        this.games = stats.games;
        this.baseRunnerStats = stats.baseRunnerStats;
        this.totalPlateAppearances = stats.totals.reduce(
          (sum, r) => sum + r.totalPA,
          0
        );
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
