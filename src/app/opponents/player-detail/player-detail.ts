import { Component, input } from '@angular/core';
import { OpponentDisplayRow } from '@ws/data-access';
import { getWobaTier } from '@ws/stats-core';
import { formatWoba, tierClass } from '@ws/stats-core';

@Component({
  selector: 'ws-player-detail',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './player-detail.html',
})
export class PlayerDetail {
  readonly row = input.required<OpponentDisplayRow>();

  readonly fmtWoba = formatWoba;

  getTierClass(woba: number): string {
    return tierClass(getWobaTier(woba));
  }

  getCumulativeLabel(year: number): string {
    const yd = this.row().yearData.get(year);
    return yd?.cumulativeLabel ?? `${year}`;
  }
}
