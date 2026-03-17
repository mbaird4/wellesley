import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PitcherOverviewData } from '@ws/core/models';

@Component({
  selector: 'ws-pitcher-overview',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './pitcher-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherOverview {
  readonly data = input.required<PitcherOverviewData | null>();
}
