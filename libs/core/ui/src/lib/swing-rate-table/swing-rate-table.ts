import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BatterSwingStats } from '@ws/core/models';

type SortKey = 'name' | 'pa' | 'swings' | 'rate';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'ws-swing-rate-table',
  standalone: true,
  imports: [PercentPipe],
  host: { class: 'block overflow-x-auto rounded-xl' },
  templateUrl: './swing-rate-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwingRateTable {
  readonly stats = input.required<BatterSwingStats[]>();

  readonly sortKey = signal<SortKey>('rate');
  readonly sortDir = signal<SortDir>('desc');

  readonly sortedStats = computed(() => {
    const rows = [...this.stats()];
    const key = this.sortKey();
    const dir = this.sortDir();
    const mul = dir === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      switch (key) {
        case 'name':
          return a.batterName.localeCompare(b.batterName) * mul;
        case 'pa':
          return (a.totalPAs - b.totalPAs) * mul;
        case 'swings':
          return (a.swingCount - b.swingCount) * mul;
        case 'rate':
          return (a.swingRate - b.swingRate) * mul;
      }
    });

    return rows;
  });

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'name' ? 'asc' : 'desc');
    }
  }
}
