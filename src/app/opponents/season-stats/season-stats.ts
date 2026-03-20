import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { SoftballDataService } from '@ws/core/data';
import type { SeasonStatsData } from '@ws/core/models';
import { LoadingState } from '@ws/core/ui';

import { FIELDING_COLUMNS, HITTING_COLUMNS, PITCHING_COLUMNS } from './stat-column';
import { StatsTable } from './stats-table';

export type StatsCategory = 'hitting' | 'pitching' | 'fielding';

@Component({
  selector: 'ws-season-stats',
  standalone: true,
  imports: [
    LoadingState,
    StatsTable,
  ],
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-stats.html',
})
export class SeasonStats {
  private readonly dataService = inject(SoftballDataService);

  readonly slug = input.required<string>();
  readonly data = signal<SeasonStatsData | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeCategory = signal<StatsCategory>('hitting');

  readonly categories: { key: StatsCategory; label: string }[] = [
    { key: 'hitting', label: 'Hitting' },
    { key: 'pitching', label: 'Pitching' },
    { key: 'fielding', label: 'Fielding' },
  ];

  readonly hittingColumns = HITTING_COLUMNS;
  readonly pitchingColumns = PITCHING_COLUMNS;
  readonly fieldingColumns = FIELDING_COLUMNS;

  readonly hittingMinPa = computed(() => {
    const d = this.data();
    const teamGp = d?.hitting?.totals?.gp;

    return teamGp ? teamGp * 2 : 0;
  });

  constructor() {
    effect(() => {
      const slug = this.slug();

      if (slug) {
        this.loadData(slug);
      }
    });
  }

  private loadData(slug: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.dataService.getOpponentSeasonStats(slug).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No season stats available for this team.');
        this.loading.set(false);
      },
    });
  }
}
