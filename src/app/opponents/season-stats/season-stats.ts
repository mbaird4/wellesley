import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { SeasonStatsData } from '@ws/core/models';

import {
  FIELDING_COLUMNS,
  HITTING_COLUMNS,
  PITCHING_COLUMNS,
} from './stat-column';
import { StatsTable } from './stats-table';

export type StatsCategory = 'hitting' | 'pitching' | 'fielding';

@Component({
  selector: 'ws-season-stats',
  standalone: true,
  imports: [StatsTable],
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-1">
      @for (cat of categories; track cat.key) {
        <button
          (click)="activeCategory.set(cat.key)"
          class="cursor-pointer rounded-lg border-none px-3 py-1.5 text-xs font-medium transition-colors"
          [class]="
            activeCategory() === cat.key
              ? 'bg-brand-bg text-brand-text'
              : 'bg-surface-elevated text-content-muted hover:text-content-bright'
          "
        >
          {{ cat.label }}
        </button>
      }
    </div>

    @if (loading()) {
      <div class="text-content-muted py-4">Loading...</div>
    } @else if (error()) {
      <div class="text-content-muted py-4">{{ error() }}</div>
    } @else if (data()) {
      @switch (activeCategory()) {
        @case ('hitting') {
          <ws-stats-table
            [columns]="hittingColumns"
            [players]="data()!.hitting.players"
            [totals]="data()!.hitting.totals"
            [opponents]="data()!.hitting.opponents"
          />
        }
        @case ('pitching') {
          <ws-stats-table
            [columns]="pitchingColumns"
            [players]="data()!.pitching.players"
            [totals]="data()!.pitching.totals"
            [opponents]="data()!.pitching.opponents"
          />
        }
        @case ('fielding') {
          <ws-stats-table
            [columns]="fieldingColumns"
            [players]="data()!.fielding.players"
            [totals]="data()!.fielding.totals"
            [opponents]="data()!.fielding.opponents"
          />
        }
      }
    }
  `,
})
export class SeasonStats {
  private readonly http = inject(HttpClient);

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

    const base = document.querySelector('base')?.getAttribute('href') || '/';

    this.http
      .get<SeasonStatsData>(`${base}data/opponents/${slug}/season-stats.json`)
      .subscribe({
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
