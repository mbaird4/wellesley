import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { MetricScale, PlayerClutchSummary } from '@ws/core/models';
import { getMetricTier, metricColorStyle, tierClass } from '@ws/core/processors';

type SortKey = 'total' | 'third' | 'second' | 'first' | 'rate' | 'name';

interface StrandedRow {
  name: string;
  total: number;
  onFirst: number;
  onSecond: number;
  onThird: number;
  scoringPosStranded: number;
  pa: number;
  strandRate: string;
  strandRateValue: number;
  strandRateStyle: Record<string, string>;
  strandRateTier: string;
}

const STRAND_RATE_SCALE: MetricScale = {
  lowerIsBetter: true,
  colorStops: [
    [0, 155, 78, 52],
    [10, 145, 72, 55],
    [15, 130, 68, 58],
    [20, 105, 72, 58],
    [25, 85, 78, 58],
    [30, 68, 82, 60],
    [35, 42, 90, 64],
    [45, 22, 88, 68],
    [60, 0, 85, 72],
  ],
  tierBreakpoints: [
    { threshold: 15, tier: 'excellent' },
    { threshold: 20, tier: 'great' },
    { threshold: 25, tier: 'above_average' },
    { threshold: 30, tier: 'average' },
  ],
};

function computeStrandedRow(player: PlayerClutchSummary): StrandedRow {
  let onFirst = 0;
  let onSecond = 0;
  let onThird = 0;

  player.events.forEach((e) => {
    e.runnersOn
      .filter((r) => r.outcome === 'stranded')
      .forEach((r) => {
        switch (r.baseBefore) {
          case 'first':
            onFirst++;
            break;
          case 'second':
            onSecond++;
            break;
          case 'third':
            onThird++;
            break;
        }
      });
  });

  const total = onFirst + onSecond + onThird;
  const strandRateValue = player.totalRunnersOn > 0 ? (total / player.totalRunnersOn) * 100 : 0;

  return {
    name: player.name,
    total,
    onFirst,
    onSecond,
    onThird,
    scoringPosStranded: onSecond + onThird,
    pa: player.runnersOnPa,
    strandRate: strandRateValue.toFixed(0),
    strandRateValue,
    strandRateStyle: metricColorStyle(strandRateValue, STRAND_RATE_SCALE),
    strandRateTier: tierClass(getMetricTier(strandRateValue, STRAND_RATE_SCALE)),
  };
}

@Component({
  selector: 'ws-clutch-stranded',
  standalone: true,
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'clutch-stranded.html',
})
export class ClutchStranded {
  readonly players = input.required<PlayerClutchSummary[]>();
  readonly filterContext = input('');

  readonly sort = signal<SortKey>('total');

  readonly sortOptions = [
    { key: 'total' as SortKey, label: 'Total LOB' },
    { key: 'rate' as SortKey, label: '% Stranded' },
    { key: 'third' as SortKey, label: 'On 3rd' },
    { key: 'second' as SortKey, label: 'On 2nd' },
    { key: 'name' as SortKey, label: 'Name' },
  ];

  readonly rows = computed<StrandedRow[]>(() =>
    this.players()
      .map(computeStrandedRow)
      .filter((r) => r.total > 0)
  );

  readonly sortedRows = computed<StrandedRow[]>(() => {
    const rows = [...this.rows()];
    const key = this.sort();

    rows.sort((a, b) => {
      switch (key) {
        case 'total':
          return b.total - a.total;
        case 'third':
          return b.onThird - a.onThird || b.total - a.total;
        case 'second':
          return b.onSecond - a.onSecond || b.total - a.total;
        case 'first':
          return b.onFirst - a.onFirst || b.total - a.total;
        case 'rate':
          return b.strandRateValue - a.strandRateValue || b.total - a.total;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return rows;
  });

  readonly teamTotals = computed(() => {
    const rows = this.rows();
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    const onFirst = rows.reduce((sum, r) => sum + r.onFirst, 0);
    const onSecond = rows.reduce((sum, r) => sum + r.onSecond, 0);
    const onThird = rows.reduce((sum, r) => sum + r.onThird, 0);
    const totalRunnersOn = this.players().reduce((sum, p) => sum + p.totalRunnersOn, 0);
    const strandRateValue = totalRunnersOn > 0 ? (total / totalRunnersOn) * 100 : 0;

    return {
      total,
      onFirst,
      onSecond,
      onThird,
      scoringPosStranded: onSecond + onThird,
      strandRate: strandRateValue.toFixed(0),
      strandRateStyle: metricColorStyle(strandRateValue, STRAND_RATE_SCALE),
    };
  });

  readonly worstOffender = computed(() => {
    const rows = this.rows();

    if (rows.length === 0) {
      return null;
    }

    return [...rows].sort((a, b) => b.total - a.total)[0];
  });
}
