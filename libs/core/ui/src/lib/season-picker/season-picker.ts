import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { LastUpdatedPipe } from '../pipes';

@Component({
  selector: 'ws-season-picker',
  standalone: true,
  imports: [LastUpdatedPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-picker.html',
})
export class SeasonPicker {
  readonly selectedYear = input.required<number>();
  readonly availableYears = input.required<number[]>();
  readonly scrapedAt = input<string | null>(null);
  readonly loading = input(false);

  readonly yearSelected = output<number>();
}
