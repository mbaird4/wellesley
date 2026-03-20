import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { LeaderboardRow } from '@ws/core/models';

interface DisplayRow extends LeaderboardRow {
  total: number;
  isLeader: boolean;
}

const LEADER_COUNT = 3;
const DEFAULT_VISIBLE = 10;

@Component({
  selector: 'ws-scoring-leaderboard',
  standalone: true,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scoring-leaderboard.html',
})
export class ScoringLeaderboard {
  readonly rows = input.required<LeaderboardRow[]>();
  readonly showAll = signal(false);

  readonly allRows = computed<DisplayRow[]>(() => {
    return this.rows().map((row, i) => ({
      ...row,
      total: row.runsScored + row.rbis,
      isLeader: i < LEADER_COUNT,
    }));
  });

  readonly visibleRows = computed(() => {
    const all = this.allRows();

    if (this.showAll() || all.length <= DEFAULT_VISIBLE) {
      return all;
    }

    return all.slice(0, DEFAULT_VISIBLE);
  });

  readonly hasMore = computed(() => this.allRows().length > DEFAULT_VISIBLE);

  toggleShowAll(): void {
    this.showAll.update((v) => !v);
  }
}
