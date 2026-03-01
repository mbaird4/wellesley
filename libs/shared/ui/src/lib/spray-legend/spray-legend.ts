import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ws-spray-legend',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2 text-xs' },
  templateUrl: './spray-legend.html',
  styleUrl: './spray-legend.scss',
})
export class SprayLegend {}
