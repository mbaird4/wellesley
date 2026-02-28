import { Component, input, output } from '@angular/core';
import { NgStyle } from '@angular/common';
import { OpponentDisplayRow, SortKey, SortDir } from '@ws/data-access';
import { formatWoba, wobaGradientStyle, abbreviateClassYear } from '@ws/stats-core';
import { PlayerDetail } from '../player-detail/player-detail';

@Component({
  selector: 'ws-player-card-list',
  standalone: true,
  imports: [NgStyle, PlayerDetail],
  host: { class: 'block' },
  templateUrl: './player-card-list.html',
})
export class PlayerCardList {
  readonly rows = input.required<OpponentDisplayRow[]>();
  readonly expandedPlayer = input.required<string | null>();
  readonly sortKey = input.required<SortKey>();
  readonly sortDir = input.required<SortDir>();

  readonly playerToggled = output<string>();
  readonly sortChanged = output<SortKey>();

  readonly fmtWoba = formatWoba;
  readonly gradientStyle = wobaGradientStyle;
  readonly abbrevClassYear = abbreviateClassYear;
}
