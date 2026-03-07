import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WobaLegend } from '@ws/core/ui';
import { BreakpointService } from '@ws/core/util';

import { OpponentDataService } from '../opponent-data.service';
import { PlayerCardList } from '../player-card-list/player-card-list';
import { PlayerTable } from '../player-table/player-table';

@Component({
  selector: 'ws-woba-tab',
  standalone: true,
  imports: [
    PlayerTable,
    PlayerCardList,
    WobaLegend,
  ],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <ws-woba-legend />

    @if (data.error()) {
      <div
        class="bg-error-bg text-error py-cell px-card border-error-border rounded-[10px] border text-[1.05rem]"
      >
        {{ data.error() }}
      </div>
    }
    @if (data.loading()) {
      <div class="loading-state">
        <i class="fa-solid fa-baseball loading-spinner"></i>
        Loading...
      </div>
    }
    @if (data.empty()) {
      <div
        class="py-section px-card text-content-dim text-center text-[1.05rem]"
      >
        No scouting data for this team yet.
      </div>
    }

    @if (
      (data.regulars().length > 0 || data.reserves().length > 0) &&
      !data.loading()
    ) {
      @if (bp.gtSm()) {
        <ws-player-table
          [regulars]="data.regulars()"
          [reserves]="data.reserves()"
          [allYears]="data.allYears()"
          [expandedPlayer]="data.expandedPlayer()"
          [sortKey]="data.sortKey()"
          [sortDir]="data.sortDir()"
          (playerToggled)="data.togglePlayer($event)"
          (sortChanged)="data.sort($event)"
          (yearSortChanged)="data.sortByYear($event)"
        />
      } @else {
        <ws-player-card-list
          [regulars]="data.regulars()"
          [reserves]="data.reserves()"
          [expandedPlayer]="data.expandedPlayer()"
          [sortKey]="data.sortKey()"
          [sortDir]="data.sortDir()"
          (playerToggled)="data.togglePlayer($event)"
          (sortChanged)="data.sort($event)"
        />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WobaTab {
  readonly data = inject(OpponentDataService);
  readonly bp = inject(BreakpointService);
}
