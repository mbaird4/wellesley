import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ws-woba-legend',
  standalone: true,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <span class="text-content-muted whitespace-nowrap text-sm">
      Cell color by cumulative wOBA
    </span>
    <div class="flex gap-0.5">
      <div class="legend-swatch tier-below_average">&lt;.290</div>
      <div class="legend-swatch tier-average">.290</div>
      <div class="legend-swatch tier-above_average">.320</div>
      <div class="legend-swatch tier-great">.350</div>
      <div class="legend-swatch tier-excellent">.400+</div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WobaLegend {}
