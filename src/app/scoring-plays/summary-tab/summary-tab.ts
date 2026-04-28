import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { DistributionRow, LeaderboardRow, PlayTypeRow, RunnerConversionRow, SacBuntSummary, ScenarioRow, StolenBaseSummary } from '@ws/core/models';
import { BoxscoreUrlPipe, StatCard } from '@ws/core/ui';

import { BaserunningSection } from '../baserunning-section/baserunning-section';
import { PlayTypeChart } from '../play-type-chart/play-type-chart';
import { RunDistribution } from '../run-distribution/run-distribution';
import { RunnerConversionSection } from '../runner-conversion-section/runner-conversion-section';
import { ScenarioHeatmap } from '../scenario-heatmap/scenario-heatmap';
import { ScoringLeaderboard } from '../scoring-leaderboard/scoring-leaderboard';

@Component({
  selector: 'ws-summary-tab',
  standalone: true,
  imports: [
    DecimalPipe,
    BoxscoreUrlPipe,
    BaserunningSection,
    PlayTypeChart,
    RunDistribution,
    RunnerConversionSection,
    ScoringLeaderboard,
    ScenarioHeatmap,
    StatCard,
  ],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './summary-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryTab {
  readonly selectedYear = input.required<number>();
  readonly totalRuns = input.required<number>();
  readonly gamesCount = input.required<number>();
  readonly typesWithCounts = input.required<PlayTypeRow[]>();
  readonly byOuts = input.required<DistributionRow[]>();
  readonly bySituation = input.required<DistributionRow[]>();
  readonly byScenario = input.required<ScenarioRow[]>();
  readonly playerBreakdowns = input.required<LeaderboardRow[]>();
  readonly sacBuntSummary = input.required<SacBuntSummary | null>();
  readonly stolenBaseSummary = input.required<StolenBaseSummary | null>();
  readonly runnerConversions = input.required<RunnerConversionRow[]>();
  readonly runsPerGame = computed(() => {
    const games = this.gamesCount();

    if (games === 0) {
      return 0;
    }

    return this.totalRuns() / games;
  });

  readonly sacBuntsExpanded = signal(false);

  toggleSacBunts(): void {
    this.sacBuntsExpanded.update((v) => !v);
  }
}
