import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SoftballStatsService } from '@ws/core/data';
import type {
  BaseSituation,
  GameScoringPlays,
  RunnerConversionRow,
  SacBuntSummary,
  ScoringPlaySummary,
  StolenBaseSummary,
} from '@ws/core/models';
import { SITUATION_LABELS } from '@ws/core/ui';

import { ByGameTab } from './by-game-tab/by-game-tab';
import { ByPlayerTab } from './by-player-tab/by-player-tab';
import type { PlayTypeRow } from './play-type-chart/play-type-chart';
import type { DistributionRow } from './run-distribution/run-distribution';
import type { ScenarioRow } from './scenario-heatmap/scenario-heatmap';
import { SummaryTab } from './summary-tab/summary-tab';

type ScoringTab = 'summary' | 'by-game' | 'by-player';

const TYPE_ORDER: string[] = [
  'homer',
  'triple',
  'double',
  'single',
  'bunt_single',
  'sac_fly',
  'sac_bunt',
  'walk',
  'hbp',
  'wild_pitch',
  'passed_ball',
  'stolen_base',
  'fielders_choice',
  'error',
  'productive_out',
  'unknown',
];

const SITUATION_ORDER: BaseSituation[] = [
  'empty',
  'first',
  'second',
  'third',
  'first_second',
  'first_third',
  'second_third',
  'loaded',
];

@Component({
  selector: 'ws-scoring-plays',
  standalone: true,
  imports: [
    ByGameTab,
    ByPlayerTab,
    SummaryTab,
  ],
  templateUrl: './scoring-plays.html',
  host: { class: 'block stats-section' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoringPlays {
  private statsService = inject(SoftballStatsService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedYear = signal(2025);
  readonly activeTab = signal<ScoringTab>('summary');

  readonly availableYears = [
    2025, 2024, 2023, 2022, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012,
    2011,
  ];

  readonly seasonSummary = signal<ScoringPlaySummary | null>(null);
  readonly gameScoringPlays = signal<GameScoringPlays[]>([]);
  readonly sacBuntSummary = signal<SacBuntSummary | null>(null);
  readonly stolenBaseSummary = signal<StolenBaseSummary | null>(null);
  readonly runnerConversions = signal<RunnerConversionRow[]>([]);
  readonly expandedGame = signal<number | null>(null);

  readonly typesWithCounts = computed<PlayTypeRow[]>(() => {
    const summary = this.seasonSummary();
    if (!summary) {
      return [];
    }

    return TYPE_ORDER.filter((t) => (summary.byType[t] || 0) > 0).map((t) => ({
      type: t,
      count: summary.byType[t],
      pct: (summary.byType[t] / summary.totalRuns) * 100,
    }));
  });

  readonly byOuts = computed<DistributionRow[]>(() => {
    const games = this.gameScoringPlays();
    const allPlays = games.flatMap((g) => g.plays);
    const total = allPlays.length;
    if (total === 0) {
      return [];
    }

    const outCounts = allPlays.reduce(
      (acc, p) => {
        acc[p.outs]++;

        return acc;
      },
      [0, 0, 0]
    );

    return outCounts.map((count, outs) => ({
      label: outs === 1 ? '1 Out' : `${outs} Outs`,
      count,
      pct: (count / total) * 100,
    }));
  });

  readonly bySituation = computed<DistributionRow[]>(() => {
    const games = this.gameScoringPlays();
    const allPlays = games.flatMap((g) => g.plays);
    const total = allPlays.length;
    if (total === 0) {
      return [];
    }

    const sitCounts: Record<string, number> = {};
    allPlays.forEach((p) => {
      sitCounts[p.baseSituation] = (sitCounts[p.baseSituation] || 0) + 1;
    });

    return SITUATION_ORDER.filter((s) => (sitCounts[s] || 0) > 0).map((s) => ({
      label: SITUATION_LABELS[s] || s,
      count: sitCounts[s],
      pct: (sitCounts[s] / total) * 100,
    }));
  });

  readonly byScenario = computed<ScenarioRow[]>(() => {
    const games = this.gameScoringPlays();
    const allPlays = games.flatMap((g) => g.plays);
    const total = allPlays.length;
    if (total === 0) {
      return [];
    }

    const scenarioMap = new Map<string, number>();
    allPlays.forEach((p) => {
      const key = `${p.baseSituation}|${p.outs}`;
      scenarioMap.set(key, (scenarioMap.get(key) || 0) + 1);
    });

    return Array.from(scenarioMap.entries())
      .map(([key, count]) => {
        const [situation, outs] = key.split('|');

        return {
          situation: situation as BaseSituation,
          outs: Number(outs),
          count,
          pct: (count / total) * 100,
        };
      })
      .sort((a, b) => b.count - a.count);
  });

  readonly playerBreakdowns = computed(() => {
    const games = this.gameScoringPlays();
    const runnerMap = new Map<
      string,
      { runsScored: number; byType: Record<string, number> }
    >();
    const batterMap = new Map<
      string,
      { rbis: number; byType: Record<string, number> }
    >();

    games
      .flatMap((game) => game.plays)
      .forEach((play) => {
        if (play.runnerName) {
          const r = runnerMap.get(play.runnerName) || {
            runsScored: 0,
            byType: {},
          };
          r.runsScored++;
          r.byType[play.scoringPlayType] =
            (r.byType[play.scoringPlayType] || 0) + 1;
          runnerMap.set(play.runnerName, r);
        }

        if (play.batterName) {
          const b = batterMap.get(play.batterName) || { rbis: 0, byType: {} };
          b.rbis++;
          b.byType[play.scoringPlayType] =
            (b.byType[play.scoringPlayType] || 0) + 1;
          batterMap.set(play.batterName, b);
        }
      });

    const allNames = new Set([...runnerMap.keys(), ...batterMap.keys()]);

    return Array.from(allNames)
      .map((name) => ({
        name,
        runsScored: runnerMap.get(name)?.runsScored || 0,
        rbis: batterMap.get(name)?.rbis || 0,
        scoredByType: runnerMap.get(name)?.byType || {},
        rbiByType: batterMap.get(name)?.byType || {},
      }))
      .sort((a, b) => b.runsScored + b.rbis - (a.runsScored + a.rbis));
  });

  readonly totalRuns = computed(() => this.seasonSummary()?.totalRuns ?? 0);
  readonly gamesCount = computed(() => this.gameScoringPlays().length);

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.seasonSummary.set(null);
    this.gameScoringPlays.set([]);
    this.sacBuntSummary.set(null);
    this.stolenBaseSummary.set(null);
    this.runnerConversions.set([]);
    this.expandedGame.set(null);

    this.statsService.getStats(this.selectedYear()).subscribe({
      next: (stats) => {
        this.seasonSummary.set(stats.seasonScoringPlays);
        this.gameScoringPlays.set(stats.gameScoringPlays);
        this.sacBuntSummary.set(stats.sacBuntSummary);
        this.stolenBaseSummary.set(stats.stolenBaseSummary);
        this.runnerConversions.set(stats.runnerConversions);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err.message || 'An error occurred while loading scoring data'
        );
        this.loading.set(false);
        console.error('Error loading scoring data:', err);
      },
    });
  }

  toggleGame(index: number): void {
    this.expandedGame.update((current) => (current === index ? null : index));
  }

  setYear(year: number): void {
    this.selectedYear.set(year);
    this.loadData();
  }

  setTab(tab: ScoringTab): void {
    this.activeTab.set(tab);
  }
}
