import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SprayDataPoint, SprayTrend } from '@ws/core/models';
import { buildCallouts, buildStats, buildZones, type Callout, detectSprayTrends, type StatCell, type ZoneRow } from '@ws/core/processors';
import { range } from '@ws/core/util';

import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { CURRENT_YEAR } from '../spray-chart-viewer/spray-chart-viewer';
import { SprayField } from '../spray-field/spray-field';
import { SprayTrendBadge } from '../spray-trend-badge/spray-trend-badge';

interface CoachRow {
  name: string;
  jersey: number;
  batsLabel: string;
  posLabel: string;
  summary: PrintPlayerSummary['summary'];
  stats: StatCell[];
  zones: ZoneRow[];
  callouts: Callout[];
  trends: SprayTrend[];
}

@Component({
  selector: 'ws-spray-chart-coach-print-view',
  standalone: true,
  imports: [
    SprayField,
    SprayTrendBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block break-before-page' },
  templateUrl: './spray-chart-coach-print-view.html',
})
export class SprayChartCoachPrintView {
  readonly players = input.required<PrintPlayerSummary[]>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly years = input<string[]>([]);
  readonly viewMode = input<string>('combined');
  readonly dataByYear = input<Map<number, SprayDataPoint[]>>(new Map());

  readonly yearsLabel = computed(() => {
    const y = this.years();

    return y.length > 0 ? `Data: ${y.join(', ')}` : '';
  });

  readonly printDate = computed(() => {
    const d = new Date();

    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  });

  readonly noteLines = range(4);

  readonly rows = computed<CoachRow[]>(() => {
    const map = this.dataByYear();
    const lastYear = CURRENT_YEAR - 1;

    return this.players().map((p) => {
      const zones = buildZones(p);
      const stats = buildStats(p);
      const callouts = buildCallouts(p);

      const thisYearData = (map.get(CURRENT_YEAR) ?? []).filter((d) => d.playerName === p.name);
      const lastYearData = (map.get(lastYear) ?? []).filter((d) => d.playerName === p.name);
      const trends = detectSprayTrends(thisYearData, lastYearData);

      return {
        name: p.name,
        jersey: p.jersey,
        batsLabel: p.bats ? `(${p.bats})` : '',
        posLabel: p.position ?? '',
        summary: p.summary,
        stats,
        zones,
        callouts,
        trends,
      };
    });
  });
}
