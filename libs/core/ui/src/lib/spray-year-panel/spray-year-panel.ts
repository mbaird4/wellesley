import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { SprayZone, ZoneAggregate } from '@ws/core/models';

import { SprayField } from '../spray-field/spray-field';
import { SprayLegend } from '../spray-legend/spray-legend';

@Component({
  selector: 'ws-spray-year-panel',
  standalone: true,
  imports: [
    SprayField,
    SprayLegend,
  ],
  templateUrl: './spray-year-panel.html',
  host: { class: 'flex flex-col gap-1' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayYearPanel {
  readonly year = input<number | null>(null);
  readonly label = input<string | null>(null);
  readonly zones = input.required<ZoneAggregate[]>();
  readonly totalContact = input.required<number>();
  readonly highlightZone = input<SprayZone | null>(null);

  readonly heading = computed(() => this.label() ?? String(this.year() ?? ''));

  readonly zoneHover = output<SprayZone | null>();
  readonly zoneClick = output<SprayZone>();
}
