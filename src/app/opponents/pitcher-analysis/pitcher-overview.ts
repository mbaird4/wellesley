import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface PitcherOverviewData {
  name: string;
  w: number;
  l: number;
  era: number;
  app: number;
  gs: number;
  ip: number;
  so: number;
  bb: number;
  h: number;
  hr: number;
}

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
