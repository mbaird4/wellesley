import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { DistributionRow } from '@ws/core/models';

type SortKey = 'label' | 'count';

interface EnrichedRow extends DistributionRow {
  barWidthPct: number;
}

@Component({
  selector: 'ws-run-distribution',
  standalone: true,
  imports: [DecimalPipe],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './run-distribution.html',
})
export class RunDistribution {
  readonly title = input.required<string>();
  readonly data = input.required<DistributionRow[]>();
  readonly sortKey = signal<SortKey>('count');
  readonly sortAsc = signal(false);

  readonly rows = computed<EnrichedRow[]>(() => {
    const d = this.data();
    const key = this.sortKey();
    const asc = this.sortAsc();
    const maxCount = d.length > 0 ? Math.max(...d.map((r) => r.count)) : 1;

    const enriched = d.map((row) => ({
      ...row,
      barWidthPct: (row.count / maxCount) * 100,
    }));

    const mult = asc ? 1 : -1;
    enriched.sort((a, b) => {
      if (key === 'label') {
        return mult * a.label.localeCompare(b.label);
      }

      return mult * (a.count - b.count);
    });

    return enriched;
  });

  sort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((v) => !v);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(key === 'label');
    }
  }
}
