import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type {
  PitcherGameLog,
  PitcherSeasonSummary,
  PitchingData,
} from '@ws/core/models';
import {
  computePitcherGameLog,
  computePitcherSeasonSummary,
  trackPitcherPerformance,
} from '@ws/core/processors';
import { StickyPlayerHeader } from '@ws/core/ui';
import { BreakpointService } from '@ws/core/util';

import { InningBreakdown } from './inning-breakdown';
import { InningDetail } from './inning-detail';
import { PitcherGameLogComponent } from './pitcher-game-log';
import type { PitcherOverviewData } from './pitcher-overview';
import { PitcherOverview } from './pitcher-overview';
import type { PitcherOption } from './pitcher-selector';
import { PitcherSelector } from './pitcher-selector';

@Component({
  selector: 'ws-pitcher-analysis',
  standalone: true,
  imports: [
    StickyPlayerHeader,
    PitcherSelector,
    PitcherOverview,
    InningBreakdown,
    InningDetail,
    PitcherGameLogComponent,
  ],
  host: { class: 'block' },
  templateUrl: './pitcher-analysis.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherAnalysis {
  readonly bp = inject(BreakpointService);

  readonly pitchingData = input.required<PitchingData | null>();
  readonly rosterNames = input<Set<string>>(new Set());
  readonly jerseyMap = input<Record<string, number> | null>(null);
  readonly loading = input<boolean>(false);
  readonly teamName = input<string>('');

  readonly selectedPitcher = signal<string | null>(null);
  readonly selectedYear = signal<number | 'all'>('all');

  /** Available years where the selected pitcher has stats, sorted descending */
  readonly availableYears = computed<number[]>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();

    if (!data || !pitcher) {
      return [];
    }

    return Object.entries(data.pitchingStatsByYear)
      .filter(([, stats]) => stats.some((p) => p.name === pitcher))
      .map(([year]) => Number(year))
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
      .sort((a, b) => b - a)
      .find((y) => (data.pitchingStatsByYear[String(y)]?.length ?? 0) > 0);

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

    return year === 'all' ? 'Career' : String(year);
  });

  /** Look up jersey number for the selected pitcher from roster data */
  readonly jerseyNumber = computed<number | null>(() => {
    const pitcher = this.effectivePitcher();
    const map = this.jerseyMap();

    if (!pitcher || !map) {
      return null;
    }

    const key = pitcher.toLowerCase().replace(/\./g, '');

    return map[key] ?? null;
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

    // "all" — aggregate stats across all years
    const yearEntries = Object.values(data.pitchingStatsByYear).flatMap(
      (stats) => stats.filter((p) => p.name === pitcher)
    );

    if (yearEntries.length === 0) {
      return null;
    }

    if (yearEntries.length === 1) {
      return yearEntries[0];
    }

    const totals = yearEntries.reduce(
      (acc, s) => ({
        w: acc.w + s.w,
        l: acc.l + s.l,
        app: acc.app + s.app,
        gs: acc.gs + s.gs,
        ip: acc.ip + s.ip,
        h: acc.h + s.h,
        r: acc.r + s.r,
        er: acc.er + s.er,
        bb: acc.bb + s.bb,
        so: acc.so + s.so,
        hr: acc.hr + s.hr,
      }),
      {
        w: 0,
        l: 0,
        app: 0,
        gs: 0,
        ip: 0,
        h: 0,
        r: 0,
        er: 0,
        bb: 0,
        so: 0,
        hr: 0,
      }
    );

    // Convert IP from display format (e.g. 99.1 = 99⅓) to true thirds for ERA calc
    const totalThirds = yearEntries.reduce((acc, s) => {
      const whole = Math.floor(s.ip);
      const frac = Math.round((s.ip - whole) * 10);

      return acc + whole * 3 + frac;
    }, 0);
    const trueIp = totalThirds / 3;
    const era =
      trueIp > 0 ? Math.round(((totals.er * 7) / trueIp) * 100) / 100 : 0;
    const displayIp = Math.floor(totalThirds / 3) + (totalThirds % 3) * 0.1;

    return {
      name: pitcher,
      ...totals,
      ip: Math.round(displayIp * 10) / 10,
      era,
    };
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
      year === 'all' ? data.games : data.games.filter((g) => g.year === year);

    // Track pitcher performance across filtered games
    const allGameLogs: PitcherGameLog[] = [];

    games.forEach((game) => {
      const plays = trackPitcherPerformance(game.battingInnings, game.pitchers);

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
