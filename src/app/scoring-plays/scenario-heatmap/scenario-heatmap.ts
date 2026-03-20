import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { BaseSituation, ScenarioRow } from '@ws/core/models';
import { FormatOutsPipe, FormatSituationPipe } from '@ws/core/ui';

interface HeatmapCell {
  count: number;
  pct: number;
  colorClass: string;
}

interface HeatmapRow {
  situation: BaseSituation;
  cells: [HeatmapCell, HeatmapCell, HeatmapCell];
  total: number;
}

const SITUATION_ORDER: BaseSituation[] = ['first', 'second', 'third', 'first_second', 'first_third', 'second_third', 'loaded', 'empty'];

function intensityClass(count: number, maxCount: number): string {
  if (count === 0) {
    return 'bg-surface-sunken';
  }

  const intensity = count / maxCount;

  if (intensity > 0.7) {
    return 'bg-chart-heat-3';
  }

  if (intensity > 0.4) {
    return 'bg-chart-heat-2';
  }

  if (intensity > 0.15) {
    return 'bg-chart-heat-1';
  }

  return 'bg-chart-muted';
}

@Component({
  selector: 'ws-scenario-heatmap',
  standalone: true,
  imports: [
    DecimalPipe,
    FormatSituationPipe,
    FormatOutsPipe,
  ],
  host: { class: 'block overflow-x-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scenario-heatmap.html',
})
export class ScenarioHeatmap {
  readonly data = input.required<ScenarioRow[]>();
  readonly outHeaders = [0, 1, 2];

  readonly matrix = computed<HeatmapRow[]>(() => {
    const scenarios = this.data();
    const lookup = new Map(scenarios.map((s) => [`${s.situation}|${s.outs}`, s]));
    const maxCount = scenarios.length > 0 ? Math.max(...scenarios.map((s) => s.count)) : 1;

    return SITUATION_ORDER.map((situation) => {
      const cells = [0, 1, 2].map((outs) => {
        const entry = lookup.get(`${situation}|${outs}`);

        return {
          count: entry?.count ?? 0,
          pct: entry?.pct ?? 0,
          colorClass: intensityClass(entry?.count ?? 0, maxCount),
        };
      }) as [HeatmapCell, HeatmapCell, HeatmapCell];

      const total = cells.reduce((sum, c) => sum + c.count, 0);

      return { situation, cells, total };
    }).filter((row) => row.total > 0);
  });
}
