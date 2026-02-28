import { Component, input } from '@angular/core';
import { OpponentDisplayRow } from '../opponent-types';
import { getWobaTier } from '../../../lib/woba';
import { formatWoba, tierClass } from '../../../lib/woba-display';

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
