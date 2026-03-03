import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type { OpponentPitchingData } from '@ws/data-access';
import { BreakpointService } from '@ws/shared/util';
import type { PitcherGameLog, PitcherSeasonSummary } from '@ws/stats-core';
import {
  computePitcherGameLog,
  computePitcherSeasonSummary,
  trackPitcherPerformance,
} from '@ws/stats-core';

import { InningBreakdown } from './inning-breakdown';
import { PitcherGameLogComponent } from './pitcher-game-log';
import type { PitcherOverviewData } from './pitcher-overview';
import { PitcherOverview } from './pitcher-overview';
import type { PitcherOption } from './pitcher-selector';
import { PitcherSelector } from './pitcher-selector';

@Component({
  selector: 'ws-pitcher-analysis',
  standalone: true,
  imports: [
    PitcherSelector,
    PitcherOverview,
    InningBreakdown,
    PitcherGameLogComponent,
  ],
  host: { class: 'block' },
  templateUrl: './pitcher-analysis.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherAnalysis {
  readonly bp = inject(BreakpointService);

  readonly pitchingData = input.required<OpponentPitchingData | null>();
  readonly rosterNames = input<Set<string>>(new Set());
  readonly loading = input<boolean>(false);

  readonly selectedPitcher = signal<string | null>(null);
  readonly selectedYear = signal<number | 'all'>('all');

  /** Available years from pitchingStatsByYear, sorted descending */
  readonly availableYears = computed<number[]>(() => {
    const data = this.pitchingData();

    if (!data) {
      return [];
    }

    return Object.keys(data.pitchingStatsByYear)
      .map(Number)
      .sort((a, b) => b - a);
  });

  /** Pitcher names from the most recent year, filtered to current roster */
  readonly pitcherList = computed<PitcherOption[]>(() => {
    const data = this.pitchingData();

    if (!data) {
      return [];
    }

    const roster = this.rosterNames();
    const latestYear = Object.keys(data.pitchingStatsByYear)
      .map(Number)
      .sort((a, b) => b - a)[0];

    if (latestYear === undefined) {
      return [];
    }

    const pitchers = data.pitchingStatsByYear[String(latestYear)] ?? [];

    // Filter to only pitchers still on the roster (if roster data available)
    const filtered =
      roster.size > 0
        ? pitchers.filter((p) =>
            roster.has(p.name.toLowerCase().replace(/\./g, ''))
          )
        : pitchers;

    return filtered.map((p) => ({
      name: p.name,
      label: p.name,
    }));
  });

  /** Auto-select first pitcher when list changes */
  readonly effectivePitcher = computed(() => {
    const selected = this.selectedPitcher();
    const list = this.pitcherList();

    if (selected && list.some((p) => p.name === selected)) {
      return selected;
    }

    return list[0]?.name ?? null;
  });

  /** Label for the year selector shown in overview header */
  readonly yearLabel = computed(() => {
    const year = this.selectedYear();

    return year === 'all' ? 'All Years' : String(year);
  });

  /** Raw stats for the selected pitcher, scoped by selected year */
  readonly rawStats = computed<PitcherOverviewData | null>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();
    const year = this.selectedYear();

    if (!data || !pitcher) {
      return null;
    }

    if (year !== 'all') {
      const stats = data.pitchingStatsByYear[String(year)];

      return stats?.find((p) => p.name === pitcher) ?? null;
    }

    // "all" — find most recent year's stats for this pitcher
    const years = Object.keys(data.pitchingStatsByYear)
      .map(Number)
      .sort((a, b) => b - a);

    for (const y of years) {
      const stats = data.pitchingStatsByYear[String(y)];
      const found = stats?.find((p) => p.name === pitcher);

      if (found) {
        return found;
      }
    }

    return null;
  });

  /** Process games to get season summary for selected pitcher, scoped by year */
  readonly seasonSummary = computed<PitcherSeasonSummary | null>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();
    const year = this.selectedYear();

    if (!data || !pitcher) {
      return null;
    }

    // Filter games by selected year
    const games =
      year === 'all'
        ? data.games
        : data.games.filter((g) => g.year === year);

    // Track pitcher performance across filtered games
    const allGameLogs: PitcherGameLog[] = [];

    games.forEach((game) => {
      const plays = trackPitcherPerformance(
        game.battingInnings,
        game.pitchers
      );

      const logs = computePitcherGameLog(plays, {
        date: game.date,
        opponent: game.opponent,
        url: game.url,
      });

      allGameLogs.push(...logs);
    });

    // Compute season summaries for all pitchers
    const summaries = computePitcherSeasonSummary(allGameLogs);

    return summaries.find((s) => s.pitcher === pitcher) ?? null;
  });

  selectPitcher(name: string): void {
    this.selectedPitcher.set(name);
  }

  selectYear(year: number | 'all'): void {
    this.selectedYear.set(year);
  }
}
