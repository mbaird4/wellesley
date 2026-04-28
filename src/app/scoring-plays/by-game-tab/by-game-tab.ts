import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { GameScoringPlays } from '@ws/core/models';
import { BoxscoreUrlPipe, BuntRelatedPipe, EmptyState, FormatPlayTypePipe, FormatSituationPipe } from '@ws/core/ui';

interface DisplayGame {
  game: GameScoringPlays;
  runsClass: string;
  dimmed: boolean;
  label: string;
}

@Component({
  selector: 'ws-by-game-tab',
  standalone: true,
  imports: [BoxscoreUrlPipe, BuntRelatedPipe, EmptyState, FormatPlayTypePipe, FormatSituationPipe],
  host: { class: 'flex flex-col' },
  templateUrl: './by-game-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ByGameTab {
  readonly selectedYear = input.required<number>();
  readonly games = input.required<GameScoringPlays[]>();
  readonly expandedGame = input.required<number | null>();
  readonly gameToggled = output<number>();

  readonly displayGames = computed<DisplayGame[]>(() => {
    const games = this.games();
    const maxRuns = games.length > 0 ? Math.max(...games.map((g) => g.summary.totalRuns)) : 1;

    const opponentCounts = new Map<string, number>();
    games.forEach((g) => {
      opponentCounts.set(g.opponent, (opponentCounts.get(g.opponent) || 0) + 1);
    });

    const opponentIndex = new Map<string, number>();

    return games.map((game) => {
      const runs = game.summary.totalRuns;
      const hasMultiple = (opponentCounts.get(game.opponent) || 0) > 1;
      let label = '';

      if (hasMultiple) {
        const idx = (opponentIndex.get(game.opponent) || 0) + 1;
        opponentIndex.set(game.opponent, idx);
        label = `G${idx}`;
      }

      let runsClass = 'text-content-muted';

      if (runs === 0) {
        runsClass = 'text-content-dim';
      } else if (runs / maxRuns > 0.7) {
        runsClass = 'text-brand-text font-semibold';
      } else if (runs / maxRuns > 0.4) {
        runsClass = 'text-content-bright';
      }

      return { game, runsClass, dimmed: runs === 0, label };
    });
  });
}
