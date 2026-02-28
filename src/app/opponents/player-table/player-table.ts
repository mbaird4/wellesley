import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { OpponentDisplayRow, SortDir, SortKey } from '@ws/data-access';
import { ClassYearPipe, WobaBadge } from '@ws/shared/ui';
import { getWobaTier } from '@ws/stats-core';
import { formatWoba, tierClass, wobaGradientStyle } from '@ws/stats-core';

import { PlayerDetail } from '../player-detail/player-detail';

@Component({
  selector: 'ws-player-table',
  standalone: true,
  imports: [NgStyle, NgTemplateOutlet, ClassYearPipe, WobaBadge, PlayerDetail],
  host: { class: 'block' },
  templateUrl: './player-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerTable {
  readonly regulars = input.required<OpponentDisplayRow[]>();
  readonly reserves = input.required<OpponentDisplayRow[]>();
  readonly allYears = input.required<number[]>();
  readonly expandedPlayer = input.required<string | null>();
  readonly sortKey = input.required<SortKey>();
  readonly sortDir = input.required<SortDir>();

  readonly playerToggled = output<string>();
  readonly sortChanged = output<SortKey>();
  readonly yearSortChanged = output<number>();

  readonly fmtWoba = formatWoba;
  readonly gradientStyle = wobaGradientStyle;

  getTierClass(woba: number): string {
    return tierClass(getWobaTier(woba));
  }
}
