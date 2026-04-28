import { NgStyle, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { DisplayRow, SortDir, SortKey } from '@ws/core/models';
import { formatWoba, wobaGradientStyle } from '@ws/core/processors';
import { ClassYearPipe } from '@ws/core/ui';

import { PlayerDetail } from '../player-detail/player-detail';

@Component({
  selector: 'ws-player-card-list',
  standalone: true,
  imports: [NgStyle, NgTemplateOutlet, ClassYearPipe, PlayerDetail],
  host: { class: 'block' },
  templateUrl: './player-card-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerCardList {
  readonly regulars = input.required<DisplayRow[]>();
  readonly reserves = input.required<DisplayRow[]>();
  readonly expandedPlayer = input.required<string | null>();
  readonly sortKey = input.required<SortKey>();
  readonly sortDir = input.required<SortDir>();

  readonly playerToggled = output<string>();
  readonly sortChanged = output<SortKey>();

  readonly fmtWoba = formatWoba;
  readonly gradientStyle = wobaGradientStyle;
}
