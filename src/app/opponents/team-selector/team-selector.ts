import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { TeamEntry } from '@ws/data-access';

@Component({
  selector: 'ws-team-selector',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './team-selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamSelector {
  readonly teams = input.required<TeamEntry[]>();
  readonly selectedSlug = input.required<string>();
  readonly layout = input<'horizontal' | 'vertical'>('vertical');
  readonly teamSelected = output<string>();
}
