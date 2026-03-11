import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { BaseRunnerMode, BaseRunnerRow, BaseSituation } from '@ws/core/models';
import { computeOutlierMap } from '@ws/core/processors';

import { ButtonToggle, type ToggleOption } from '../button-toggle/button-toggle';
import { OutlierClassPipe } from '../pipes/outlier-class.pipe';

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

  readonly activeRows = computed(() => (this.mode() === 'at-bat-start' ? this.rowsAtBatStart() : this.rows()));
  readonly outlierMap = computed(() => computeOutlierMap(this.activeRows()));
}
