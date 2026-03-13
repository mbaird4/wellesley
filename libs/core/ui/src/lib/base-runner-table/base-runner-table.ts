import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { BaseRunnerMode, BaseRunnerRow, BaseSituation } from '@ws/core/models';
import { computeOutlierMap } from '@ws/core/processors';

import { ButtonToggle, type ToggleOption } from '../button-toggle/button-toggle';
import { OutlierClassPipe, type OutlierLevel } from '../pipes/outlier-class.pipe';

const SITUATIONS: { key: BaseSituation; label: string }[] = [
  { key: 'empty', label: 'No one on' },
  { key: 'first', label: '1st' },
  { key: 'second', label: '2nd' },
  { key: 'third', label: '3rd' },
  { key: 'first_second', label: '1st & 2nd' },
  { key: 'first_third', label: '1st & 3rd' },
  { key: 'second_third', label: '2nd & 3rd' },
  { key: 'loaded', label: 'Loaded' },
];

const MODE_OPTIONS: ToggleOption[] = [
  { value: 'at-bat-start', label: 'Start of AB' },
  { value: 'ball-in-play', label: 'Ball in Play' },
];

const ALL_OUTLIER_LEVELS: OutlierLevel[] = ['outlier-high-strong', 'outlier-high-mild', 'outlier-low-mild', 'outlier-low-strong'];

const OUTLIER_LEGEND: { level: OutlierLevel; label: string }[] = [
  { level: 'outlier-high-strong', label: 'Most often' },
  { level: 'outlier-high-mild', label: 'More often' },
  { level: 'outlier-low-mild', label: 'Less often' },
  { level: 'outlier-low-strong', label: 'Least often' },
];

@Component({
  selector: 'ws-base-runner-table',
  standalone: true,
  imports: [
    ButtonToggle,
    OutlierClassPipe,
  ],
  templateUrl: './base-runner-table.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseRunnerTable {
  readonly rows = input.required<BaseRunnerRow[]>();
  readonly rowsAtBatStart = input.required<BaseRunnerRow[]>();
  readonly mode = input.required<BaseRunnerMode>();
  readonly showToggle = input(false);
  readonly showTotals = input(true);
  readonly compact = input(false);

  readonly modeChange = output<BaseRunnerMode>();

  readonly situations = SITUATIONS;
  readonly modeOptions = MODE_OPTIONS;
  readonly outlierLegend = OUTLIER_LEGEND;

  readonly activeRows = computed(() => (this.mode() === 'at-bat-start' ? this.rowsAtBatStart() : this.rows()));
  readonly outlierMap = computed(() => computeOutlierMap(this.activeRows()));
  readonly visibleOutliers = signal<OutlierLevel[]>([...ALL_OUTLIER_LEVELS]);

  readonly outlierActive = computed(() => {
    const set = new Set(this.visibleOutliers());

    return {
      'outlier-high-strong': set.has('outlier-high-strong'),
      'outlier-high-mild': set.has('outlier-high-mild'),
      'outlier-low-mild': set.has('outlier-low-mild'),
      'outlier-low-strong': set.has('outlier-low-strong'),
    };
  });

  toggleOutlier(level: OutlierLevel): void {
    const current = this.visibleOutliers();
    const next = current.includes(level) ? current.filter((l) => l !== level) : [...current, level];
    this.visibleOutliers.set(next);
  }
}
