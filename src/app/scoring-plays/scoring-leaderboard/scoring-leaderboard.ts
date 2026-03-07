import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface LeaderboardRow {
  name: string;
  runsScored: number;
  rbis: number;
}

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
        @for (row of rows(); track row.name; let i = $index) {
          <tr>
            <td class="text-content-dim w-8 text-center text-xs">
              {{ i + 1 }}
            </td>
            <td>{{ row.name }}</td>
            <td class="tabular-nums">{{ row.runsScored }}</td>
            <td class="tabular-nums">{{ row.rbis }}</td>
            <td class="text-brand-text font-semibold tabular-nums">
              {{ row.runsScored + row.rbis }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class ScoringLeaderboard {
  readonly rows = input.required<LeaderboardRow[]>();
}
