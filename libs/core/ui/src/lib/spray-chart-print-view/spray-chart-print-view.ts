import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { SprayChartSummary } from '@ws/core/models';

import { SprayField } from '../spray-field/spray-field';
import { SprayLegend } from '../spray-legend/spray-legend';

export interface PrintPlayerSummary {
  name: string;
  jersey: number;
  summary: SprayChartSummary;
  bats?: 'L' | 'R' | 'S' | null;
  position?: string | null;
  avg?: number;
  woba?: number;
  pa?: number;
  sb?: number;
  gp?: number;
  sh?: number;
}

@Component({
  selector: 'ws-spray-chart-print-view',
  standalone: true,
  imports: [SprayField, SprayLegend],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block' },
  templateUrl: './spray-chart-print-view.html',
})
export class SprayChartPrintView {
  readonly players = input.required<PrintPlayerSummary[]>();
  readonly title = input('');
  readonly subtitle = input('');
}
