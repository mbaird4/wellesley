import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RosterService, SoftballDataService } from '@ws/core/data';
import type { BatterSwingStats } from '@ws/core/models';
import { buildOpponentPitcherSequences, computeBatterSwingStats } from '@ws/core/processors';
import { EmptyState, ErrorBanner, LoadingState, SwingRateTable } from '@ws/core/ui';
import { CURRENT_YEAR } from '@ws/core/util';

@Component({
  selector: 'ws-outlet-approach',
  standalone: true,
  imports: [EmptyState, ErrorBanner, LoadingState, SwingRateTable],
  host: { class: 'block stats-section' },
  templateUrl: './outlet-approach.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutletApproach {
  private readonly dataService = inject(SoftballDataService);
  readonly rosterService = inject(RosterService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<BatterSwingStats[]>([]);
  readonly totalGames = signal(0);

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dataService.getGameData(CURRENT_YEAR).subscribe({
      next: (games) => {
        this.totalGames.set(games.length);
        const records = buildOpponentPitcherSequences(games);
        this.stats.set(computeBatterSwingStats(records));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load approach data');
        this.loading.set(false);
      },
    });
  }
}
