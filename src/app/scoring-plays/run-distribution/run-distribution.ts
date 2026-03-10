import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface DistributionRow {
  label: string;
  count: number;
  pct: number;
}

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
  template: `
    <h3 class="section-heading-sm">{{ title() }}</h3>
    <div class="mt-3 flex flex-col gap-2.5">
      <!-- Header -->
      <div class="flex items-center gap-3 px-1 py-1">
        <button class="text-content-dim hover:text-content-muted w-28 shrink-0 cursor-pointer border-none bg-transparent text-right text-xs font-semibold tracking-widest uppercase transition-colors" (click)="sort('label')">
          {{ title() }}
        </button>
        <button class="text-content-dim hover:text-content-muted min-w-0 flex-1 cursor-pointer border-none bg-transparent text-left text-xs font-semibold tracking-widest uppercase transition-colors" (click)="sort('count')">Runs</button>
        <button class="text-content-dim hover:text-content-muted w-14 cursor-pointer border-none bg-transparent text-right text-xs font-semibold tracking-widest uppercase transition-colors" (click)="sort('count')">%</button>
      </div>

      @for (row of rows(); track row.label) {
        <div class="flex items-center gap-3">
          <span class="text-content-secondary w-28 shrink-0 text-right text-sm font-medium">
            {{ row.label }}
          </span>

          <div class="bg-surface-sunken relative flex h-7 min-w-0 flex-1 items-center overflow-hidden rounded-md">
            <div class="bg-chart-bar absolute inset-y-0 left-0 rounded-md transition-all duration-300" [style.width.%]="row.barWidthPct"></div>
            <span class="text-content-bright relative z-10 pl-2 text-xs font-semibold tabular-nums">
              {{ row.count }}
            </span>
          </div>

          <span class="text-content-muted w-14 text-right text-sm tabular-nums"> {{ row.pct | number: '1.1-1' }}% </span>
        </div>
      }
    </div>
  `,
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
