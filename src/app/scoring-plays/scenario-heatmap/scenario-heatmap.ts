import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { BaseSituation } from '@ws/core/models';
import { FormatOutsPipe, FormatSituationPipe } from '@ws/core/ui';

export interface ScenarioRow {
  situation: BaseSituation;
  outs: number;
  count: number;
  pct: number;
}

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

const SITUATION_ORDER: BaseSituation[] = [
  'first',
  'second',
  'third',
  'first_second',
  'first_third',
  'second_third',
  'loaded',
  'empty',
];

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
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full border-separate" style="border-spacing: 3px">
        <thead>
          <tr>
            <th
              class="text-content-dim px-3 py-2 text-left text-xs font-medium tracking-widest uppercase"
            ></th>
            @for (outs of outHeaders; track outs) {
              <th
                class="text-content-muted w-24 px-3 py-2 text-center text-xs font-semibold tracking-widest uppercase"
              >
                {{ outs | formatOuts }}
              </th>
            }
            <th
              class="text-content-dim w-16 px-3 py-2 text-center text-xs font-medium tracking-widest uppercase"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          @for (row of matrix(); track row.situation) {
            <tr>
              <td
                class="text-content-secondary px-3 py-2 text-sm font-medium whitespace-nowrap"
              >
                {{ row.situation | formatSituation }}
              </td>
              @for (cell of row.cells; track $index) {
                <td
                  class="rounded-lg px-3 py-2.5 text-center text-sm font-semibold tabular-nums transition-colors"
                  [class]="cell.colorClass"
                >
                  @if (cell.count > 0) {
                    <span class="text-content-bright">{{ cell.count }}</span>
                    <span class="text-content-dim ml-1 text-xs font-normal">
                      {{ cell.pct | number: '1.0-0' }}%
                    </span>
                  } @else {
                    <span class="text-content-empty">—</span>
                  }
                </td>
              }
              <td
                class="text-content-muted px-3 py-2 text-center text-sm tabular-nums"
              >
                {{ row.total }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ScenarioHeatmap {
  readonly data = input.required<ScenarioRow[]>();
  readonly outHeaders = [0, 1, 2];

  readonly matrix = computed<HeatmapRow[]>(() => {
    const scenarios = this.data();
    const lookup = new Map(
      scenarios.map((s) => [`${s.situation}|${s.outs}`, s])
    );
    const maxCount =
      scenarios.length > 0 ? Math.max(...scenarios.map((s) => s.count)) : 1;

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
