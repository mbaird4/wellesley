import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

export interface LeaderboardRow {
  name: string;
  runsScored: number;
  rbis: number;
}

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
  template: `
    <table class="stats-table">
      <thead>
        <tr>
          <th></th>
          <th>Player</th>
          <th>Runs</th>
          <th>RBI</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        @for (row of visibleRows(); track row.name; let i = $index) {
          <tr>
            <td
              class="w-8 text-center text-xs"
              [class]="row.isLeader ? 'text-brand-text' : 'text-content-dim'"
            >
              {{ i + 1 }}
            </td>
            <td [class]="row.isLeader ? 'text-content-heading' : ''">
              {{ row.name }}
            </td>
            <td class="tabular-nums">{{ row.runsScored }}</td>
            <td class="tabular-nums">{{ row.rbis }}</td>
            <td class="text-brand-text font-semibold tabular-nums">
              {{ row.total }}
            </td>
          </tr>
        }
      </tbody>
    </table>

    @if (hasMore()) {
      <button
        class="text-content-dim hover:text-content-muted mt-2 cursor-pointer border-none bg-transparent text-sm font-medium transition-colors"
        (click)="toggleShowAll()"
      >
        @if (showAll()) {
          Show fewer
        } @else {
          Show all {{ allRows().length }} players
        }
      </button>
    }
  `,
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
