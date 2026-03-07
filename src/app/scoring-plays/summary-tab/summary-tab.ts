import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type {
  RunnerConversionRow,
  SacBuntSummary,
  StolenBaseSummary,
} from '@ws/core/models';
import { BoxscoreUrlPipe } from '@ws/core/ui';

import { BaserunningSection } from '../baserunning-section/baserunning-section';
import {
  PlayTypeChart,
  type PlayTypeRow,
} from '../play-type-chart/play-type-chart';
import type { DistributionRow } from '../run-distribution/run-distribution';
import { RunDistribution } from '../run-distribution/run-distribution';
import {
  ScenarioHeatmap,
  type ScenarioRow,
} from '../scenario-heatmap/scenario-heatmap';
import {
  type LeaderboardRow,
  ScoringLeaderboard,
} from '../scoring-leaderboard/scoring-leaderboard';

@Component({
  selector: 'ws-summary-tab',
  standalone: true,
  imports: [
    DecimalPipe,
    BoxscoreUrlPipe,
    BaserunningSection,
    PlayTypeChart,
    RunDistribution,
    ScoringLeaderboard,
    ScenarioHeatmap,
  ],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './summary-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryTab {
  readonly selectedYear = input.required<number>();
  readonly totalRuns = input.required<number>();
  readonly typesWithCounts = input.required<PlayTypeRow[]>();
  readonly byOuts = input.required<DistributionRow[]>();
  readonly bySituation = input.required<DistributionRow[]>();
  readonly byScenario = input.required<ScenarioRow[]>();
  readonly playerBreakdowns = input.required<LeaderboardRow[]>();
  readonly sacBuntSummary = input.required<SacBuntSummary | null>();
  readonly stolenBaseSummary = input.required<StolenBaseSummary | null>();
  readonly runnerConversions = input.required<RunnerConversionRow[]>();
}
