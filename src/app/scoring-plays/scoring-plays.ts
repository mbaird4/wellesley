import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SoftballStatsService } from '@ws/core/data';
import type {
  BaseSituation,
  GameScoringPlays,
  SacBuntSummary,
  ScoringPlaySummary,
} from '@ws/core/models';
import {
  FormatOutsPipe,
  FormatPlayTypePipe,
  FormatSituationPipe,
  IsEmptyPipe,
} from '@ws/core/ui';

interface PlayerScoringBreakdown {
  name: string;
  runsScored: number;
  rbis: number;
  scoredByType: Record<string, number>;
  rbiByType: Record<string, number>;
}

@Component({
  selector: 'ws-scoring-plays',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FormatOutsPipe,
    FormatPlayTypePipe,
    FormatSituationPipe,
    IsEmptyPipe,
  ],
  templateUrl: './scoring-plays.html',
  host: { class: 'block stats-section' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoringPlays {
  private statsService = inject(SoftballStatsService);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  error: string | null = null;
  selectedYear = 2025;
  availableYears = [
    2025, 2024, 2023, 2022, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012,
    2011,
  ];

  activeTab: 'summary' | 'by-game' | 'by-player' = 'summary';

  seasonSummary: ScoringPlaySummary | null = null;
  gameScoringPlays: GameScoringPlays[] = [];
  playerBreakdowns: PlayerScoringBreakdown[] = [];
  sacBuntSummary: SacBuntSummary | null = null;
  expandedGame: number | null = null;
  typesWithCounts: { type: string; count: number; pct: number }[] = [];
  sortedRunners: { name: string; count: number }[] = [];
  sortedBatters: { name: string; count: number }[] = [];

  // Scenario breakdowns
  byOuts: { outs: number; count: number; pct: number }[] = [];
  bySituation: { situation: BaseSituation; count: number; pct: number }[] = [];
  byScenario: {
    situation: BaseSituation;
    outs: number;
    count: number;
    pct: number;
  }[] = [];

  // Ordered list of scoring play types for display
  readonly typeOrder: string[] = [
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

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.seasonSummary = null;
    this.gameScoringPlays = [];
    this.playerBreakdowns = [];
    this.sacBuntSummary = null;
    this.expandedGame = null;

    this.statsService.getStats(this.selectedYear).subscribe({
      next: (stats) => {
        this.seasonSummary = stats.seasonScoringPlays;
        this.gameScoringPlays = stats.gameScoringPlays;
        this.sacBuntSummary = stats.sacBuntSummary;
        this.buildTypesWithCounts();
        this.buildSortedRunners();
        this.buildSortedBatters();
        this.buildPlayerBreakdowns(stats.gameScoringPlays);
        this.buildScenarioBreakdowns(stats.gameScoringPlays);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error =
          err.message || 'An error occurred while loading scoring data';
        this.loading = false;
        console.error('Error loading scoring data:', err);
        this.cdr.markForCheck();
      },
    });
  }

  toggleGame(index: number): void {
    this.expandedGame = this.expandedGame === index ? null : index;
  }

  isBuntRelated(type: string): boolean {
    return type === 'bunt_single' || type === 'sac_bunt';
  }

  private buildTypesWithCounts(): void {
    if (!this.seasonSummary) {
      this.typesWithCounts = [];

      return;
    }

    const summary = this.seasonSummary;
    this.typesWithCounts = this.typeOrder
      .filter((t) => (summary.byType[t] || 0) > 0)
      .map((t) => ({
        type: t,
        count: summary.byType[t],
        pct: (summary.byType[t] / summary.totalRuns) * 100,
      }));
  }

  private buildSortedRunners(): void {
    if (!this.seasonSummary) {
      this.sortedRunners = [];

      return;
    }

    this.sortedRunners = Object.entries(this.seasonSummary.byRunner)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private buildSortedBatters(): void {
    if (!this.seasonSummary) {
      this.sortedBatters = [];

      return;
    }

    this.sortedBatters = Object.entries(this.seasonSummary.byBatter)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private buildPlayerBreakdowns(games: GameScoringPlays[]): void {
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

    // Merge into unified player list
    const allNames = new Set([...runnerMap.keys(), ...batterMap.keys()]);
    this.playerBreakdowns = Array.from(allNames)
      .map((name) => ({
        name,
        runsScored: runnerMap.get(name)?.runsScored || 0,
        rbis: batterMap.get(name)?.rbis || 0,
        scoredByType: runnerMap.get(name)?.byType || {},
        rbiByType: batterMap.get(name)?.byType || {},
      }))
      .sort((a, b) => b.runsScored + b.rbis - (a.runsScored + a.rbis));
  }

  private buildScenarioBreakdowns(games: GameScoringPlays[]): void {
    const allPlays = games.flatMap((g) => g.plays);
    const total = allPlays.length;
    if (total === 0) {
      this.byOuts = [];
      this.bySituation = [];
      this.byScenario = [];

      return;
    }

    // By outs
    const outCounts = allPlays.reduce(
      (acc, p) => {
        acc[p.outs]++;

        return acc;
      },
      [0, 0, 0]
    );

    this.byOuts = outCounts.map((count, outs) => ({
      outs,
      count,
      pct: (count / total) * 100,
    }));

    // By base situation
    const sitCounts: Record<string, number> = {};
    allPlays.forEach((p) => {
      sitCounts[p.baseSituation] = (sitCounts[p.baseSituation] || 0) + 1;
    });

    const sitOrder: BaseSituation[] = [
      'empty',
      'first',
      'second',
      'third',
      'first_second',
      'first_third',
      'second_third',
      'loaded',
    ];
    this.bySituation = sitOrder
      .filter((s) => (sitCounts[s] || 0) > 0)
      .map((s) => ({
        situation: s,
        count: sitCounts[s],
        pct: (sitCounts[s] / total) * 100,
      }));

    // Cross-tab: situation × outs
    const scenarioMap = new Map<string, number>();
    allPlays.forEach((p) => {
      const key = `${p.baseSituation}|${p.outs}`;
      scenarioMap.set(key, (scenarioMap.get(key) || 0) + 1);
    });

    this.byScenario = Array.from(scenarioMap.entries())
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
  }

  boxscoreUrl(url: string): string {
    return url.replace(/^\/wellesleyblue/, 'https://wellesleyblue.com');
  }
}
