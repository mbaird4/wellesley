import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PlayTypeRow } from '@ws/core/models';
import { FormatPlayTypePipe } from '@ws/core/ui';

type SortKey = 'value' | 'count';

// wOBA-inspired ordering: higher offensive value = higher rank.
// Non-PA events get 0 so they sort to the bottom.
const TYPE_VALUE: Record<string, number> = {
  homer: 2.5,
  triple: 1.7,
  double: 1.2,
  single: 0.9,
  bunt_single: 0.9,
  walk: 0.5,
  hbp: 0.5,
  sac_fly: 0.4,
  sac_bunt: 0.3,
};

interface EnrichedRow extends PlayTypeRow {
  barWidthPct: number;
  barColorClass: string;
}

const BAR_COLORS: Record<string, string> = {
  homer: 'bg-chart-green',
  triple: 'bg-chart-teal',
  double: 'bg-chart-yellow',
  single: 'bg-chart-blue',
  bunt_single: 'bg-chart-blue',
  sac_fly: 'bg-chart-orange',
  sac_bunt: 'bg-chart-orange',
  walk: 'bg-chart-yellow',
  hbp: 'bg-chart-yellow',
};

const DEFAULT_BAR_COLOR = 'bg-chart-muted';

@Component({
  selector: 'ws-play-type-chart',
  standalone: true,
  imports: [DecimalPipe, FormatPlayTypePipe],
  host: { class: 'flex flex-col gap-1.5' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './play-type-chart.html',
})
export class PlayTypeChart {
  readonly data = input.required<PlayTypeRow[]>();
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
      barColorClass: BAR_COLORS[row.type] ?? DEFAULT_BAR_COLOR,
    }));

    const mult = asc ? 1 : -1;
    enriched.sort((a, b) => {
      if (key === 'value') {
        const aVal = TYPE_VALUE[a.type] ?? 0;
        const bVal = TYPE_VALUE[b.type] ?? 0;

        return mult * (aVal - bVal);
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
      this.sortAsc.set(false);
    }
  }
}
