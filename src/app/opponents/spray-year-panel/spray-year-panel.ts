import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type { SprayZone, ZoneAggregate } from '@ws/core/models';
import { SprayField, SprayLegend } from '@ws/core/ui';

@Component({
  selector: 'ws-spray-year-panel',
  standalone: true,
  imports: [
    SprayField,
    SprayLegend,
  ],
  templateUrl: './spray-year-panel.html',
  host: { class: 'flex flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayYearPanel {
  readonly year = input.required<number>();
  readonly zones = input.required<ZoneAggregate[]>();
  readonly totalContact = input.required<number>();
  readonly highlightZone = input<SprayZone | null>(null);

  readonly zoneHover = output<SprayZone | null>();
  readonly zoneClick = output<SprayZone>();
}
