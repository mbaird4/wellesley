import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { OpponentDisplayRow, SortDir, SortKey } from '@ws/data-access';
import {
  abbreviateClassYear,
  formatWoba,
  wobaGradientStyle,
} from '@ws/stats-core';

import { PlayerDetail } from '../player-detail/player-detail';

@Component({
  selector: 'ws-player-card-list',
  standalone: true,
  imports: [NgStyle, NgTemplateOutlet, PlayerDetail],
  host: { class: 'block' },
  templateUrl: './player-card-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerCardList {
  readonly regulars = input.required<OpponentDisplayRow[]>();
  readonly reserves = input.required<OpponentDisplayRow[]>();
  readonly expandedPlayer = input.required<string | null>();
  readonly sortKey = input.required<SortKey>();
  readonly sortDir = input.required<SortDir>();

  readonly playerToggled = output<string>();
  readonly sortChanged = output<SortKey>();

  readonly fmtWoba = formatWoba;
  readonly gradientStyle = wobaGradientStyle;
  readonly abbrevClassYear = abbreviateClassYear;
}
