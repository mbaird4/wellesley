import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type { GameScoringPlays } from '@ws/core/models';
import {
  BoxscoreUrlPipe,
  BuntRelatedPipe,
  FormatPlayTypePipe,
  FormatSituationPipe,
} from '@ws/core/ui';

@Component({
  selector: 'ws-by-game-tab',
  standalone: true,
  imports: [
    BoxscoreUrlPipe,
    BuntRelatedPipe,
    FormatPlayTypePipe,
    FormatSituationPipe,
  ],
  host: { class: 'flex flex-col' },
  templateUrl: './by-game-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ByGameTab {
  readonly selectedYear = input.required<number>();
  readonly games = input.required<GameScoringPlays[]>();
  readonly expandedGame = input.required<number | null>();
  readonly gameToggled = output<number>();
}
