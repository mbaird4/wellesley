import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { SlideToggle } from '@ws/shared/ui';
import type { PitcherGameLog, PitcherInningStats } from '@ws/stats-core';
import {
  battingAvgAgainst,
  inningToNumber,
  wobaAgainst,
  wobaColorStyle,
} from '@ws/stats-core';

const EMPTY_STYLE: Record<string, string> = {};

function fmtStat(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

interface InningGameRow {
  date: string;
  opponent: string;
  battersFaced: number;
  hits: number;
  runs: number;
  strikeouts: number;
  walks: number;
  formattedAvg: string;
  formattedWoba: string;
  avgStyle: Record<string, string>;
  wobaStyle: Record<string, string>;
}

interface InningTotalsRow {
  battersFaced: number;
  hits: number;
  runs: number;
  strikeouts: number;
  walks: number;
  formattedAvg: string;
  formattedWoba: string;
  avgStyle: Record<string, string>;
  wobaStyle: Record<string, string>;
}

function buildGameRow(
  log: PitcherGameLog,
  inn: PitcherInningStats,
  showColors: boolean
): InningGameRow {
  const avg = battingAvgAgainst(inn);
  const woba = wobaAgainst(inn);

  return {
    date: log.date,
    opponent: log.opponent,
    battersFaced: inn.battersFaced,
    hits: inn.hits,
    runs: inn.runs,
    strikeouts: inn.strikeouts,
    walks: inn.walks,
    formattedAvg: fmtStat(avg),
    formattedWoba: fmtStat(woba),
    avgStyle: showColors ? wobaColorStyle(0.55 - avg * 1.2) : EMPTY_STYLE,
    wobaStyle: showColors ? wobaColorStyle(0.55 - woba) : EMPTY_STYLE,
  };
}

function buildTotalsRow(
  stats: PitcherInningStats,
  showColors: boolean
): InningTotalsRow {
  const avg = battingAvgAgainst(stats);
  const woba = wobaAgainst(stats);

  return {
    battersFaced: stats.battersFaced,
    hits: stats.hits,
    runs: stats.runs,
    strikeouts: stats.strikeouts,
    walks: stats.walks,
    formattedAvg: fmtStat(avg),
    formattedWoba: fmtStat(woba),
    avgStyle: showColors ? wobaColorStyle(0.55 - avg * 1.2) : EMPTY_STYLE,
    wobaStyle: showColors ? wobaColorStyle(0.55 - woba) : EMPTY_STYLE,
  };
}

@Component({
  selector: 'ws-inning-detail',
  standalone: true,
  imports: [SlideToggle],
  host: { class: 'block' },
  templateUrl: './inning-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InningDetail {
  readonly gameLogs = input.required<PitcherGameLog[]>();
  readonly byInning = input.required<Map<string, PitcherInningStats>>();

  readonly selectedInning = signal<string | null>(null);
  readonly colorCoding = signal(true);

  /** Available innings sorted numerically */
  readonly availableInnings = computed<string[]>(() => {
    const keys = Array.from(this.byInning().keys());

    return keys.sort((a, b) => inningToNumber(a) - inningToNumber(b));
  });

  /** Auto-select first inning if none selected */
  readonly effectiveInning = computed<string | null>(() => {
    const selected = this.selectedInning();
    const available = this.availableInnings();

    if (selected && available.includes(selected)) {
      return selected;
    }

    return available[0] ?? null;
  });

  /** Game-by-game rows for the selected inning */
  readonly gameRows = computed<InningGameRow[]>(() => {
    const inning = this.effectiveInning();
    const showColors = this.colorCoding();

    if (!inning) {
      return [];
    }

    const rows: InningGameRow[] = [];

    [...this.gameLogs()].reverse().forEach((log) => {
      const inn = log.innings.find((i) => i.inning === inning);

      if (inn) {
        rows.push(buildGameRow(log, inn, showColors));
      }
    });

    return rows;
  });

  /** Aggregate totals for the selected inning */
  readonly totalsRow = computed<InningTotalsRow | null>(() => {
    const inning = this.effectiveInning();
    const showColors = this.colorCoding();

    if (!inning) {
      return null;
    }

    const stats = this.byInning().get(inning);

    if (!stats) {
      return null;
    }

    return buildTotalsRow(stats, showColors);
  });

  selectInning(inning: string): void {
    this.selectedInning.set(inning);
  }
}
