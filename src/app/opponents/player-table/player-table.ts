import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type { DisplayRow, SortDir, SortKey } from '@ws/core/models';
import {
  formatWoba,
  getWobaTier,
  tierClass,
  wobaGradientStyle,
} from '@ws/core/processors';
import { ClassYearPipe, WobaBadge } from '@ws/core/ui';

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
  readonly regulars = input.required<DisplayRow[]>();
  readonly reserves = input.required<DisplayRow[]>();
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
