import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { PitchCountInningStats, PitcherGameLog, PitcherOption, PitcherOverviewData, PitcherSeasonSummary, PitcherValidationResult, PitchingData, Roster } from '@ws/core/models';
import { applyBoxScoreToGameLogs, buildWellesleyPitcherSequences, computePitchCountByInning, computePitcherGameLog, computePitcherSeasonSummary, reconcileInheritedRuns, trackPitcherPerformance, validatePitcherStats } from '@ws/core/processors';
import { LoadingState, PitcherScoutingPrintView, StickyPlayerHeader } from '@ws/core/ui';
import { BreakpointService, CURRENT_YEAR } from '@ws/core/util';

import { InningBreakdown } from './inning-breakdown';
import { InningDetail } from './inning-detail';
import { PitchCountBreakdown } from './pitch-count-breakdown';
import { PitcherGameLogComponent } from './pitcher-game-log';
import { PitcherOverview } from './pitcher-overview';
import { PitcherSelector } from './pitcher-selector';
import { PitcherValidationBanner } from './pitcher-validation-banner';

@Component({
  selector: 'ws-pitcher-analysis',
  standalone: true,
  imports: [
    InningBreakdown,
    InningDetail,
    LoadingState,
    PitchCountBreakdown,
    PitcherGameLogComponent,
    PitcherOverview,
    PitcherScoutingPrintView,
    PitcherSelector,
    PitcherValidationBanner,
    StickyPlayerHeader,
  ],
  host: { class: 'block' },
  templateUrl: './pitcher-analysis.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherAnalysis {
  readonly bp = inject(BreakpointService);

  readonly pitchingData = input.required<PitchingData | null>();
  readonly rosterNames = input<Set<string>>(new Set());
  readonly roster = input<Roster | null>(null);
  readonly jerseyMap = input<Record<string, number> | null>(null);
  readonly loading = input<boolean>(false);
  readonly teamName = input<string>('');

  readonly selectedPitcher = signal<string | null>(null);
  readonly selectedYear = signal<number | 'all'>(CURRENT_YEAR);

  /** Available years where the selected pitcher has stats, sorted descending */
  readonly availableYears = computed<number[]>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();

    if (!data || !pitcher) {
      return [];
    }

    const years = Object.entries(data.pitchingStatsByYear)
      .filter(([, stats]) => stats.some((p) => p.name === pitcher))
      .map(([year]) => Number(year));

    // Always include current year so the selector shows it even before data exists
    if (!years.includes(CURRENT_YEAR)) {
      years.push(CURRENT_YEAR);
    }

    return years.sort((a, b) => b - a);
  });

  /** Pitcher names across all years, filtered to current roster */
  readonly pitcherList = computed<PitcherOption[]>(() => {
    const data = this.pitchingData();

    if (!data) {
      return [];
    }

    const roster = this.rosterNames();

    // Collect unique pitcher names across all years (most recent year first)
    const seen = new Set<string>();
    const pitchers: PitcherOption[] = [];

    Object.keys(data.pitchingStatsByYear)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((year) => {
        (data.pitchingStatsByYear[String(year)] ?? []).forEach((p) => {
          const key = p.name.toLowerCase().replace(/\./g, '');

          if (!seen.has(key) && (roster.size === 0 || roster.has(key))) {
            seen.add(key);
            pitchers.push({ name: p.name, label: p.name });
          }
        });
      });

    return pitchers;
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
    const yearEntries = Object.values(data.pitchingStatsByYear).flatMap((stats) => stats.filter((p) => p.name === pitcher));

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
        cg: acc.cg + s.cg,
        sho: acc.sho + s.sho,
        sv: acc.sv + s.sv,
        ip: acc.ip + s.ip,
        h: acc.h + s.h,
        r: acc.r + s.r,
        er: acc.er + s.er,
        bb: acc.bb + s.bb,
        so: acc.so + s.so,
        hr: acc.hr + s.hr,
        doubles: acc.doubles + s.doubles,
        triples: acc.triples + s.triples,
        ab: acc.ab + s.ab,
        wp: acc.wp + s.wp,
        hbp: acc.hbp + s.hbp,
        bk: acc.bk + s.bk,
        sfa: acc.sfa + s.sfa,
        sha: acc.sha + s.sha,
      }),
      {
        w: 0,
        l: 0,
        app: 0,
        gs: 0,
        cg: 0,
        sho: 0,
        sv: 0,
        ip: 0,
        h: 0,
        r: 0,
        er: 0,
        bb: 0,
        so: 0,
        hr: 0,
        doubles: 0,
        triples: 0,
        ab: 0,
        wp: 0,
        hbp: 0,
        bk: 0,
        sfa: 0,
        sha: 0,
      }
    );

    // Convert IP from display format (e.g. 99.1 = 99⅓) to true thirds for ERA calc
    const totalThirds = yearEntries.reduce((acc, s) => {
      const whole = Math.floor(s.ip);
      const frac = Math.round((s.ip - whole) * 10);

      return acc + whole * 3 + frac;
    }, 0);
    const trueIp = totalThirds / 3;
    const era = trueIp > 0 ? Math.round(((totals.er * 7) / trueIp) * 100) / 100 : 0;
    const whip = trueIp > 0 ? Math.round(((totals.bb + totals.h) / trueIp) * 100) / 100 : 0;
    const bAvg = totals.ab > 0 ? Math.round((totals.h / totals.ab) * 1000) / 1000 : 0;
    const displayIp = Math.floor(totalThirds / 3) + (totalThirds % 3) * 0.1;

    return {
      name: pitcher,
      ...totals,
      ip: Math.round(displayIp * 10) / 10,
      era,
      whip,
      bAvg,
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
    const games = year === 'all' ? data.games : data.games.filter((g) => g.year === year);

    // Track pitcher performance across filtered games
    const allGameLogs: PitcherGameLog[] = [];

    games.forEach((game) => {
      const plays = trackPitcherPerformance(game.battingInnings, game.pitchers, data.nameAliases);
      const gameInfo = { date: game.date, opponent: game.opponent, url: game.url };

      let logs = computePitcherGameLog(plays, gameInfo);

      if (game.pitcherBoxScore) {
        logs = applyBoxScoreToGameLogs(logs, game.pitcherBoxScore, gameInfo);
      }

      allGameLogs.push(...logs);
    });

    // Compute season summaries for all pitchers
    const summaries = computePitcherSeasonSummary(allGameLogs);

    // Reconcile inherited-runner run misattribution using raw stats
    if (year !== 'all') {
      const rawStats = data.pitchingStatsByYear[String(year)] ?? [];
      reconcileInheritedRuns(summaries, rawStats);
    }

    return summaries.find((s) => s.pitcher === pitcher) ?? null;
  });

  readonly pitchCountData = computed<{ byInning: Map<string, PitchCountInningStats>; totals: PitchCountInningStats } | null>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();
    const year = this.selectedYear();

    if (!data || !pitcher) {
      return null;
    }

    const games = year === 'all' ? data.games : data.games.filter((g) => g.year === year);
    const records = buildWellesleyPitcherSequences(games);
    const result = computePitchCountByInning(records, pitcher);

    if (result.totals.pasWithSequence === 0) {
      return null;
    }

    return result;
  });

  /** Pitch-count totals per pitcher for the current year — used by the print view for 1st K% and 1-2 K%. */
  readonly pitchCountByPitcher = computed<Map<string, PitchCountInningStats>>(() => {
    const data = this.pitchingData();

    if (!data) {
      return new Map();
    }

    const currentYearGames = data.games.filter((g) => g.year === CURRENT_YEAR);
    const records = buildWellesleyPitcherSequences(currentYearGames);
    const allNames = new Set<string>();

    Object.values(data.pitchingStatsByYear).forEach((stats) => {
      stats.forEach((s) => allNames.add(s.name));
    });

    const result = new Map<string, PitchCountInningStats>();
    allNames.forEach((name) => {
      const { totals } = computePitchCountByInning(records, name);

      if (totals.pasWithSequence > 0) {
        result.set(name, totals);
      }
    });

    return result;
  });

  /** Compare raw stats vs computed play-by-play stats (single-year only) */
  readonly validation = computed<PitcherValidationResult | null>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();
    const year = this.selectedYear();
    const summary = this.seasonSummary();

    if (!data || !pitcher || year === 'all' || !summary) {
      return null;
    }

    const stats = data.pitchingStatsByYear[String(year)];
    const rawStats = stats?.find((p) => p.name === pitcher);

    if (!rawStats) {
      return null;
    }

    return validatePitcherStats(rawStats, summary.totals, summary.games);
  });

  selectPitcher(name: string): void {
    this.selectedPitcher.set(name);
  }

  selectYear(year: number | 'all'): void {
    this.selectedYear.set(year);
  }

  onPrint(): void {
    this.bp.printing.set(true);

    // Wait a tick so Angular renders the print view before the browser captures it
    setTimeout(() => {
      window.print();
      this.bp.printing.set(false);
    });
  }
}
