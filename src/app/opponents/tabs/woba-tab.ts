import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErrorBanner, LoadingState, WobaLegend } from '@ws/core/ui';
import { BreakpointService } from '@ws/core/util';

import { OpponentDataService } from '../opponent-data.service';
import { PlayerCardList } from '../player-card-list/player-card-list';
import { PlayerTable } from '../player-table/player-table';

@Component({
  selector: 'ws-woba-tab',
  standalone: true,
  imports: [
    ErrorBanner,
    LoadingState,
    PlayerCardList,
    PlayerTable,
    WobaLegend,
  ],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <ws-woba-legend />

    @if (data.error()) {
      <ws-error-banner [message]="data.error()!" />
    }
    @if (data.loading()) {
      <ws-loading-state />
    }
    @if (data.empty()) {
      <div class="py-section px-card text-content-dim text-center text-[1.05rem]">No scouting data for this team yet.</div>
    }

    @if ((data.regulars().length > 0 || data.reserves().length > 0) && !data.loading()) {
      @if (bp.gtSm()) {
        <ws-player-table [regulars]="data.regulars()" [reserves]="data.reserves()" [allYears]="data.allYears()" [expandedPlayer]="data.expandedPlayer()" [sortKey]="data.sortKey()" [sortDir]="data.sortDir()" [yearSortYear]="data.yearSortYear()" (playerToggled)="data.togglePlayer($event)" (sortChanged)="data.sort($event)" (yearSortChanged)="data.sortByYear($event)" />
      } @else {
        <ws-player-card-list [regulars]="data.regulars()" [reserves]="data.reserves()" [expandedPlayer]="data.expandedPlayer()" [sortKey]="data.sortKey()" [sortDir]="data.sortDir()" (playerToggled)="data.togglePlayer($event)" (sortChanged)="data.sort($event)" />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WobaTab {
  readonly data = inject(OpponentDataService);
  readonly bp = inject(BreakpointService);
}
