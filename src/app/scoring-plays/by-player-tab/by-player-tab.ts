import { KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormatPlayTypePipe, IsEmptyPipe } from '@ws/core/ui';

interface PlayerScoringBreakdown {
  name: string;
  runsScored: number;
  rbis: number;
  scoredByType: Record<string, number>;
  rbiByType: Record<string, number>;
}

@Component({
  selector: 'ws-by-player-tab',
  standalone: true,
  imports: [
    KeyValuePipe,
    FormatPlayTypePipe,
    IsEmptyPipe,
  ],
  host: { class: 'flex flex-col' },
  templateUrl: './by-player-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ByPlayerTab {
  readonly selectedYear = input.required<number>();
  readonly players = input.required<PlayerScoringBreakdown[]>();
}
