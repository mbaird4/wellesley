import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { BattingMetric } from '@ws/core/models';

export interface MetricOption {
  value: BattingMetric;
  label: string;
}

const DEFAULT_OPTIONS: MetricOption[] = [
  { value: 'avg', label: 'AVG' },
  { value: 'woba', label: 'wOBA' },
];

@Component({
  selector: 'ws-metric-toggle',
  standalone: true,
  host: { class: 'flex items-center gap-1' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metric-toggle.html',
})
export class MetricToggle {
  readonly options = input<MetricOption[]>(DEFAULT_OPTIONS);
  readonly value = input.required<BattingMetric>();
  readonly valueChange = output<BattingMetric>();
}
