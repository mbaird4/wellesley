import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErrorBanner, LoadingState, WobaLegend } from '@ws/core/ui';
import { BreakpointService } from '@ws/core/util';

import { OpponentDataService } from '../opponent-data.service';
import { PlayerCardList } from '../player-card-list/player-card-list';
import { PlayerTable } from '../player-table/player-table';

@Component({
  selector: 'ws-woba-tab',
  standalone: true,
  imports: [ErrorBanner, LoadingState, PlayerCardList, PlayerTable, WobaLegend],
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './woba-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WobaTab {
  readonly data = inject(OpponentDataService);
  readonly bp = inject(BreakpointService);
}
