import { Component, input, output } from '@angular/core';
import { NgStyle } from '@angular/common';
import { OpponentDisplayRow, SortKey, SortDir } from '@ws/data-access';
import { getWobaTier } from '@ws/stats-core';
import { formatWoba, tierClass, wobaGradientStyle, abbreviateClassYear } from '@ws/stats-core';
import { WobaBadge } from '@ws/shared/ui';
import { PlayerDetail } from '../player-detail/player-detail';

@Component({
  selector: 'ws-player-table',
  standalone: true,
  imports: [NgStyle, WobaBadge, PlayerDetail],
  host: { class: 'block' },
  templateUrl: './player-table.html',
})
export class PlayerTable {
  readonly rows = input.required<OpponentDisplayRow[]>();
  readonly allYears = input.required<number[]>();
  readonly expandedPlayer = input.required<string | null>();
  readonly sortKey = input.required<SortKey>();
  readonly sortDir = input.required<SortDir>();

  readonly playerToggled = output<string>();
  readonly sortChanged = output<SortKey>();
  readonly yearSortChanged = output<number>();

  readonly fmtWoba = formatWoba;
  readonly gradientStyle = wobaGradientStyle;
  readonly abbrevClassYear = abbreviateClassYear;

  getTierClass(woba: number): string {
    return tierClass(getWobaTier(woba));
  }
}
