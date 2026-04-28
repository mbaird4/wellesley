import { NgTemplateOutlet, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BatterSwingStats } from '@ws/core/models';

interface SwingDisplayRow {
  batterName: string;
  jersey: number | null;
  totalPAs: number;
  swingCount: number;
  swingRate: number;
}

type SortKey = 'name' | 'jersey' | 'rate';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'ws-swing-rate-table',
  standalone: true,
  imports: [NgTemplateOutlet, PercentPipe],
  host: { class: 'block overflow-x-auto rounded-xl' },
  templateUrl: './swing-rate-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwingRateTable {
  readonly stats = input.required<BatterSwingStats[]>();
  readonly jerseyMap = input<Record<string, number>>({});
  readonly totalGames = input(0);

  readonly sortKey = signal<SortKey>('rate');
  readonly sortDir = signal<SortDir>('desc');

  readonly minPa = computed(() => this.totalGames() * 2);

  readonly regulars = computed(() => {
    const min = this.minPa();

    return this.sortRows(this.buildRows(this.stats().filter((s) => s.totalPAs >= min)));
  });

  readonly reserves = computed(() => {
    const min = this.minPa();

    if (min === 0) {
      return [];
    }

    return this.sortRows(this.buildRows(this.stats().filter((s) => s.totalPAs < min)));
  });

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'name' ? 'asc' : 'desc');
    }
  }

  private buildRows(stats: BatterSwingStats[]): SwingDisplayRow[] {
    const jMap = this.jerseyMap();

    return stats.map((s) => ({
      ...s,
      jersey: jMap[s.batterName] ?? null,
    }));
  }

  private sortRows(rows: SwingDisplayRow[]): SwingDisplayRow[] {
    const key = this.sortKey();
    const mul = this.sortDir() === 'asc' ? 1 : -1;
    const sorted = [...rows];

    sorted.sort((a, b) => {
      switch (key) {
        case 'name':
          return a.batterName.localeCompare(b.batterName) * mul;
        case 'jersey':
          return ((a.jersey ?? 999) - (b.jersey ?? 999)) * mul;
        case 'rate':
          return (a.swingRate - b.swingRate) * mul;
      }
    });

    return sorted;
  }
}
