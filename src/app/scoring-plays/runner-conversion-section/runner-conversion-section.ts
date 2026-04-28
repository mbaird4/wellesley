import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { RunnerConversionRow } from '@ws/core/models';
import { SITUATION_LABELS } from '@ws/core/ui';

type SortKey = 'situation' | 'runners' | 'scored' | 'rate';

interface ConversionDisplayRow {
  label: string;
  situation: string;
  totalRunners: number;
  runnersScored: number;
  rate: number;
  barWidthPct: number;
}

@Component({
  selector: 'ws-runner-conversion-section',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './runner-conversion-section.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunnerConversionSection {
  readonly runnerConversions = input<RunnerConversionRow[]>([]);

  readonly sortKey = signal<SortKey>('situation');
  readonly sortAsc = signal(true);

  readonly sortedConversions = computed<ConversionDisplayRow[]>(() => {
    const rows = this.runnerConversions();
    const key = this.sortKey();
    const asc = this.sortAsc();

    const withRate = rows
      .filter((r) => r.totalRunners > 0)
      .map((r) => ({
        label: SITUATION_LABELS[r.situation] || r.situation,
        situation: r.situation,
        totalRunners: r.totalRunners,
        runnersScored: r.runnersScored,
        rate: r.runnersScored / r.totalRunners,
        barWidthPct: 0,
      }));

    const maxRate = withRate.length > 0 ? Math.max(...withRate.map((r) => r.rate)) : 1;

    withRate.forEach((r) => {
      r.barWidthPct = (r.rate / maxRate) * 100;
    });

    const mult = asc ? 1 : -1;
    withRate.sort((a, b) => {
      switch (key) {
        case 'situation':
          return mult * a.label.localeCompare(b.label);
        case 'runners':
          return mult * (a.totalRunners - b.totalRunners);
        case 'scored':
          return mult * (a.runnersScored - b.runnersScored);
        case 'rate':
          return mult * (a.rate - b.rate);
        default:
          return 0;
      }
    });

    return withRate;
  });

  sort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((v) => !v);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
  }
}
