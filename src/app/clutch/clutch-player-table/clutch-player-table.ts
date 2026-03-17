import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { ClutchMetric, PlayerClutchSummary } from '@ws/core/models';

import type { DisplayCard } from './clutch-card.utils';
import { buildContactBreakdown, buildDeltaArrow, buildDeltaLabel, buildDeltaPillClass, buildHeadline, buildRunnerLine, calcAvg, confidenceWeightedDelta, formatValue, getSituationValue, getValues, SITUATION_LABELS, valueColor } from './clutch-card.utils';

export { ClutchMetric };

type SortKey = 'delta' | 'robValue' | 'drivenIn' | 'name';

@Component({
  selector: 'ws-clutch-player-table',
  standalone: true,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clutch-player-table.html',
})
export class ClutchPlayerTable {
  readonly players = input.required<PlayerClutchSummary[]>();
  readonly situationFilter = input('runners-on');
  readonly selectedPlayer = input<string | null>(null);
  readonly playerSelected = output<PlayerClutchSummary>();
  readonly metricChanged = output<ClutchMetric>();

  readonly metric = signal<ClutchMetric>('woba');
  readonly sort = signal<SortKey>('delta');
  constructor() {
    effect(() => {
      this.metricChanged.emit(this.metric());
    });
  }

  readonly sortOptions = [
    { key: 'delta' as SortKey, label: 'Clutch Factor' },
    { key: 'robValue' as SortKey, label: 'ROB Value' },
    { key: 'drivenIn' as SortKey, label: 'Driven In' },
    { key: 'name' as SortKey, label: 'Name' },
  ];

  readonly cards = computed<DisplayCard[]>(() => {
    const players = [...this.players()];
    const key = this.sort();
    const m = this.metric();

    const withValues = players.map((p) => {
      const v = getValues(p, m);

      return { player: p, ...v };
    });

    withValues.sort((a, b) => {
      switch (key) {
        case 'delta': {
          const aWeighted = confidenceWeightedDelta(a.delta, a.robPa, a.emptyPa);
          const bWeighted = confidenceWeightedDelta(b.delta, b.robPa, b.emptyPa);

          return bWeighted - aWeighted;
        }

        case 'robValue':
          return b.rob - a.rob;
        case 'drivenIn':
          return b.player.runnersDrivenIn - a.player.runnersDrivenIn;
        case 'name':
          return a.player.name.localeCompare(b.player.name);
        default:
          return 0;
      }
    });

    const situation = this.situationFilter();

    return withValues.map(({ player: p, rob, empty, delta, robPa, emptyPa }) => {
      console.log(p.name, p.overallStats);
      const overallVal = m === 'avg' ? calcAvg(p.overallStats) : p.overallWoba;
      const overallPa = m === 'avg' ? p.overallStats.ab : p.overallStats.pa;

      const sv = getSituationValue(p, situation, m);
      const situationStats = [
        {
          label: SITUATION_LABELS[situation] ?? situation,
          formatted: formatValue(sv.value, sv.pa, m),
          color: valueColor(sv.value, sv.pa, m),
        },
      ];

      return {
        player: p,
        headline: buildHeadline(delta, robPa, emptyPa, m, situation),
        deltaLabel: buildDeltaLabel(delta, robPa, emptyPa, m),
        deltaArrow: buildDeltaArrow(delta, robPa, emptyPa, m),
        deltaPillClass: buildDeltaPillClass(delta, robPa, emptyPa, m),
        emptyFormatted: formatValue(empty, emptyPa, m),
        emptyColor: valueColor(empty, emptyPa, m),
        situationStats,
        contactBreakdown: buildContactBreakdown(p.events),
        overallFormatted: formatValue(overallVal, overallPa, m),
        overallColor: valueColor(overallVal, overallPa, m),
        overallTooltip: `Overall ${m === 'avg' ? 'batting average' : 'wOBA'} across all situations`,
        runnerLine: buildRunnerLine(p),
        robValue: rob,
        delta,
      };
    });
  });
}
