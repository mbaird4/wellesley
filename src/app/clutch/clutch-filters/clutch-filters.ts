import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ToggleOption } from '@ws/core/ui';
import { ButtonToggle, SlideToggle } from '@ws/core/ui';

const OUTS_OPTIONS: ToggleOption[] = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
];

const SITUATION_OPTIONS: ToggleOption[] = [
  { value: 'runners-on', label: 'Runners On' },
  { value: 'risp', label: 'RISP' },
  { value: 'loaded', label: 'Loaded' },
];

const INNING_OPTIONS: ToggleOption[] = [
  { value: 'early', label: '1-3' },
  { value: 'middle', label: '4-5' },
  { value: 'late', label: '6+' },
];

@Component({
  selector: 'ws-clutch-filters',
  standalone: true,
  imports: [ButtonToggle, SlideToggle],
  host: { class: 'flex flex-wrap items-center gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clutch-filters.html',
})
export class ClutchFilters {
  readonly outsFilter = input.required<string[]>();
  readonly situationFilter = input.required<string>();
  readonly inningFilter = input.required<string[]>();
  readonly pinchHitOnly = input.required<boolean>();

  readonly outsChanged = output<string[]>();
  readonly situationChanged = output<string>();
  readonly inningChanged = output<string[]>();
  readonly pinchHitToggled = output<boolean>();

  readonly outsOptions = OUTS_OPTIONS;
  readonly situationOptions = SITUATION_OPTIONS;
  readonly inningOptions = INNING_OPTIONS;
}
