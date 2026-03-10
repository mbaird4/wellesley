import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import type { PitcherGameLog, PitcherInningStats } from '@ws/core/models';
import {
  battingAvgAgainst,
  inningToNumber,
  wobaAgainst,
  wobaColorStyle,
} from '@ws/core/processors';
import { ButtonToggle, type ToggleOption } from '@ws/core/ui';

import type {
  InningsTableRow,
  InningsTotalsRow,
} from './pitcher-innings-table';
import { PitcherInningsTable } from './pitcher-innings-table';

type MatrixStat = 'H' | 'R' | 'BB' | 'K' | 'AVG' | 'wOBA';

const STAT_OPTIONS: ToggleOption[] = [
  { value: 'H', label: 'H' },
  { value: 'R', label: 'R' },
  { value: 'BB', label: 'BB' },
  { value: 'K', label: 'K' },
  { value: 'AVG', label: 'AVG' },
  { value: 'wOBA', label: 'wOBA' },
];

const EMPTY_STYLE: Record<string, string> = {};

/**
 * Color lookup tables for counting stats.
 * Index = count value, value = woba scale input for wobaColorStyle.
 * Higher woba scale = greener (good for pitcher).
 */
const COUNT_COLOR_MAP: Record<string, number[]> = {
  H: [0.55, 0.35, 0.15, 0.0],
  R: [0.55, 0.25, 0.0],
  BB: [0.55, 0.3, 0.0],
};

/** Standalone K color ramp — 0 = muted dash, 1 = purple, 2 = teal, 3+ = green */
const K_COLORS: Record<string, string>[] = [
  { color: 'hsl(0, 0%, 35%)' },
  { color: 'hsl(270, 70%, 65%)' },
  { color: 'hsl(180, 75%, 52%)' },
  { color: 'hsl(140, 70%, 65%)' },
];

function fmtStat(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

function extractYear(dateStr: string): number {
  const match = dateStr.match(/(\d{4})/);

  return match ? parseInt(match[1], 10) : 0;
}

/** Get the color style for a counting stat cell */
function countStatColor(stat: string, count: number): Record<string, string> {
  if (stat === 'K') {
    const idx = Math.min(count, K_COLORS.length - 1);

    return K_COLORS[idx];
  }

  const table = COUNT_COLOR_MAP[stat];

  if (!table) {
    return EMPTY_STYLE;
  }

  const idx = Math.min(count, table.length - 1);

  return wobaColorStyle(table[idx]);
}

/** Get the color style for a rate stat cell */
function rateStatColor(
  stat: MatrixStat,
  innStats: PitcherInningStats
): Record<string, string> {
  if (stat === 'AVG') {
    const avg = battingAvgAgainst(innStats);

    return wobaColorStyle(0.55 - avg * 1.2);
  }

  const woba = wobaAgainst(innStats);

  return wobaColorStyle(0.55 - woba);
}

/** Extract the display value for a cell given the stat mode */
function cellValue(stat: MatrixStat, innStats: PitcherInningStats): string {
  switch (stat) {
    case 'H':
      return String(innStats.hits);
    case 'R':
      return String(innStats.runs);
    case 'BB':
      return String(innStats.walks);
    case 'K':
      return String(innStats.strikeouts);
    case 'AVG':
      return fmtStat(battingAvgAgainst(innStats));
    case 'wOBA':
      return fmtStat(wobaAgainst(innStats));
  }
}

/** Raw count for a counting stat */
function rawCount(stat: MatrixStat, innStats: PitcherInningStats): number {
  switch (stat) {
    case 'H':
      return innStats.hits;
    case 'R':
      return innStats.runs;
    case 'BB':
      return innStats.walks;
    case 'K':
      return innStats.strikeouts;
    default:
      return 0;
  }
}

/** K color based on K-per-out rate (for totals) */
function kRateColor(innStats: PitcherInningStats): Record<string, string> {
  if (innStats.outs === 0 || innStats.strikeouts === 0) {
    return K_COLORS[0];
  }

  const kPerOut = innStats.strikeouts / innStats.outs;

  // ~0.5 K/IP → purple, ~1.0 K/IP → teal, ~1.5+ K/IP → green
  if (kPerOut < 0.17) {
    return K_COLORS[0];
  }

  if (kPerOut < 0.34) {
    return K_COLORS[1];
  }

  if (kPerOut < 0.5) {
    return K_COLORS[2];
  }

  return K_COLORS[3];
}

/** Get the color style for a cell */
function cellColor(
  stat: MatrixStat,
  innStats: PitcherInningStats
): Record<string, string> {
  if (stat === 'AVG' || stat === 'wOBA') {
    return rateStatColor(stat, innStats);
  }

  return countStatColor(stat, rawCount(stat, innStats));
}

/** Get the color style for a total cell (uses rate for K) */
function totalCellColor(
  stat: MatrixStat,
  innStats: PitcherInningStats
): Record<string, string> {
  if (stat === 'K') {
    return kRateColor(innStats);
  }

  return cellColor(stat, innStats);
}

interface MatrixCell {
  value: string;
  style: Record<string, string>;
  empty: boolean;
}

interface MatrixGameRow {
  url: string;
  date: string;
  opponent: string;
  cells: MatrixCell[];
  inningRows: InningsTableRow[];
  inningTotals: InningsTotalsRow;
}

export interface MatrixYearGroup {
  year: number;
  games: MatrixGameRow[];
}

interface ColumnTotal {
  value: string;
  style: Record<string, string>;
}

/** Build InningsTableRow for expansion panel */
function buildInningView(inn: PitcherInningStats): InningsTableRow {
  const avg = battingAvgAgainst(inn);
  const woba = wobaAgainst(inn);

  return {
    inning: inn.inning,
    battersFaced: inn.battersFaced,
    hits: inn.hits,
    runs: inn.runs,
    strikeouts: inn.strikeouts,
    walks: inn.walks,
    formattedAvg: fmtStat(avg),
    formattedWoba: fmtStat(woba),
    avgStyle: wobaColorStyle(0.55 - avg * 1.2),
    wobaStyle: wobaColorStyle(0.55 - woba),
  };
}

/** Build InningsTotalsRow for expansion panel */
function buildTotalsView(totals: PitcherInningStats): InningsTotalsRow {
  const avg = battingAvgAgainst(totals);
  const woba = wobaAgainst(totals);

  return {
    battersFaced: totals.battersFaced,
    hits: totals.hits,
    runs: totals.runs,
    strikeouts: totals.strikeouts,
    walks: totals.walks,
    formattedAvg: fmtStat(avg),
    formattedWoba: fmtStat(woba),
    avgStyle: wobaColorStyle(0.55 - avg * 1.2),
    wobaStyle: wobaColorStyle(0.55 - woba),
  };
}

@Component({
  selector: 'ws-inning-detail',
  standalone: true,
  imports: [
    ButtonToggle,
    PitcherInningsTable,
  ],
  host: { class: 'block' },
  templateUrl: './inning-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InningDetail {
  readonly gameLogs = input.required<PitcherGameLog[]>();
  readonly byInning = input.required<Map<string, PitcherInningStats>>();

  readonly statOptions = STAT_OPTIONS;
  readonly selectedStat = signal<string>('R');
  readonly selectedInnings = signal<string[]>([
    '1st',
    '2nd',
    '3rd',
    '4th',
    '5th',
    '6th',
    '7th',
  ]);

  readonly expandedUrl = signal<string | null>(null);

  /** Available innings sorted numerically */
  readonly availableInnings = computed<string[]>(() => {
    const keys = Array.from(this.byInning().keys());

    return keys.sort((a, b) => inningToNumber(a) - inningToNumber(b));
  });

  /** Toggle options derived from available innings */
  readonly inningToggleOptions = computed<ToggleOption[]>(() =>
    this.availableInnings().map((inn) => ({ value: inn, label: inn }))
  );

  /** Effective visible inning columns — all when none selected */
  readonly effectiveInnings = computed<string[]>(() => {
    const selected = this.selectedInnings();
    const available = this.availableInnings();

    if (selected.length === 0) {
      return available;
    }

    return available.filter((inn) => selected.includes(inn));
  });

  /** Whether the user has actively filtered to a subset of innings */
  readonly isFiltered = computed(() => this.selectedInnings().length > 0);

  /** Game rows grouped by year */
  readonly yearGroups = computed<MatrixYearGroup[]>(() => {
    const logs = this.gameLogs();
    const innings = this.effectiveInnings();
    const stat = this.selectedStat() as MatrixStat;
    const filtered = this.isFiltered();
    const groups = new Map<number, MatrixGameRow[]>();

    [...logs].reverse().forEach((log) => {
      if (log.totals.outs === 0) {
        return;
      }

      // When filtering to specific innings, skip games with no data in any of them
      if (
        filtered &&
        !innings.some((inn) => log.innings.find((i) => i.inning === inn))
      ) {
        return;
      }

      const cells = innings.map((inn) => {
        const innStats = log.innings.find((i) => i.inning === inn);

        if (!innStats) {
          return { value: '-', style: EMPTY_STYLE, empty: true };
        }

        return {
          value: cellValue(stat, innStats),
          style: cellColor(stat, innStats),
          empty: false,
        };
      });

      const row: MatrixGameRow = {
        url: log.url,
        date: log.date,
        opponent: log.opponent,
        cells,
        inningRows: log.innings.map(buildInningView),
        inningTotals: buildTotalsView(log.totals),
      };

      const year = extractYear(log.date);
      const existing = groups.get(year);

      if (existing) {
        existing.push(row);
      } else {
        groups.set(year, [row]);
      }
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, games]) => ({ year, games }));
  });

  readonly hasMultipleYears = computed(() => this.yearGroups().length > 1);

  /** Column totals from the aggregated byInning data */
  readonly columnTotals = computed<ColumnTotal[]>(() => {
    const innings = this.effectiveInnings();
    const stat = this.selectedStat() as MatrixStat;
    const byInning = this.byInning();

    return innings.map((inn) => {
      const innStats = byInning.get(inn);

      if (!innStats) {
        return { value: '-', style: EMPTY_STYLE };
      }

      return {
        value: cellValue(stat, innStats),
        style: totalCellColor(stat, innStats),
      };
    });
  });

  toggleExpand(url: string): void {
    this.expandedUrl.update((current) => (current === url ? null : url));
  }
}
