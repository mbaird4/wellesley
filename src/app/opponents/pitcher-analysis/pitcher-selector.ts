import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export interface PitcherOption {
  name: string;
  label: string;
}

@Component({
  selector: 'ws-pitcher-selector',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './pitcher-selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherSelector {
  readonly pitchers = input.required<PitcherOption[]>();
  readonly selectedPitcher = input.required<string | null>();
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');
  readonly pitcherSelected = output<string>();
}
