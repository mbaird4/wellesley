import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SoftballStatsService } from '@ws/data-access';
import type {
  BaseSituation,
  GameScoringPlays,
  SacBuntSummary,
  ScoringPlaySummary,
} from '@ws/stats-core';
import { ScoringPlay } from '@ws/stats-core';

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

  formatType(type: string): string {
    const labels: Record<string, string> = {
      homer: 'Home Run',
      triple: 'Triple',
      double: 'Double',
      single: 'Single',
      bunt_single: 'Bunt Single',
      sac_fly: 'Sac Fly',
      sac_bunt: 'Sac Bunt',
      walk: 'Walk',
      hbp: 'Hit By Pitch',
      wild_pitch: 'Wild Pitch',
      passed_ball: 'Passed Ball',
      stolen_base: 'Stolen Base',
      fielders_choice: "Fielder's Choice",
      error: 'Error',
      productive_out: 'Productive Out',
      unknown: 'Unknown',
    };

    return labels[type] || type;
  }

  isBuntRelated(type: string): boolean {
    return type === 'bunt_single' || type === 'sac_bunt';
  }

  getTypesWithCounts(): { type: string; count: number; pct: number }[] {
    if (!this.seasonSummary) {
      return [];
    }

    return this.typeOrder
      .filter((t) => (this.seasonSummary!.byType[t] || 0) > 0)
      .map((t) => ({
        type: t,
        count: this.seasonSummary!.byType[t],
        pct:
          (this.seasonSummary!.byType[t] / this.seasonSummary!.totalRuns) * 100,
      }));
  }

  getSortedRunners(): { name: string; count: number }[] {
    if (!this.seasonSummary) {
      return [];
    }

    return Object.entries(this.seasonSummary.byRunner)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  getSortedBatters(): { name: string; count: number }[] {
    if (!this.seasonSummary) {
      return [];
    }

    return Object.entries(this.seasonSummary.byBatter)
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

    for (const game of games) {
      for (const play of game.plays) {
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
      }
    }

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

  formatSituation(situation: string): string {
    const labels: Record<string, string> = {
      empty: 'Bases Empty',
      first: 'Runner on 1st',
      second: 'Runner on 2nd',
      third: 'Runner on 3rd',
      first_second: '1st & 2nd',
      first_third: '1st & 3rd',
      second_third: '2nd & 3rd',
      loaded: 'Bases Loaded',
    };

    return labels[situation] || situation;
  }

  formatOuts(outs: number): string {
    return outs === 1 ? '1 Out' : `${outs} Outs`;
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
    const outCounts = [0, 0, 0];
    for (const p of allPlays) {
      outCounts[p.outs]++;
    }

    this.byOuts = outCounts.map((count, outs) => ({
      outs,
      count,
      pct: (count / total) * 100,
    }));

    // By base situation
    const sitCounts: Record<string, number> = {};
    for (const p of allPlays) {
      sitCounts[p.baseSituation] = (sitCounts[p.baseSituation] || 0) + 1;
    }

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
    for (const p of allPlays) {
      const key = `${p.baseSituation}|${p.outs}`;
      scenarioMap.set(key, (scenarioMap.get(key) || 0) + 1);
    }

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
