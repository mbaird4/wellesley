import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PitcherGameLog, PitcherInningStats } from '@ws/core/models';
import { battingAvgAgainst, wobaAgainst, wobaColorStyle } from '@ws/core/processors';
import { SlideToggle } from '@ws/core/ui';

import type { InningsTableRow } from './pitcher-innings-table';
import { PitcherInningsTable } from './pitcher-innings-table';

const EMPTY_STYLE: Record<string, string> = {};

function fmtStat(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

function fmtIP(outs: number): string {
  const full = Math.floor(outs / 3);
  const rem = outs % 3;

  return rem === 0 ? `${full}.0` : `${full}.${rem}`;
}

function buildInningView(inn: PitcherInningStats, showColors: boolean): InningsTableRow {
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
    avgStyle: showColors ? wobaColorStyle(0.55 - avg * 1.2) : EMPTY_STYLE,
    wobaStyle: showColors ? wobaColorStyle(0.55 - woba) : EMPTY_STYLE,
  };
}

interface GameLogView {
  url: string;
  date: string;
  opponent: string;
  formattedIP: string;
  totals: InningsTableRow;
  innings: InningsTableRow[];
}

export interface GameLogYearGroup {
  year: number;
  games: GameLogView[];
}

function extractYear(dateStr: string): number {
  const match = dateStr.match(/(\d{4})/);

  return match ? parseInt(match[1], 10) : 0;
}

@Component({
  selector: 'ws-pitcher-game-log',
  standalone: true,
  imports: [
    SlideToggle,
    PitcherInningsTable,
  ],
  host: { class: 'block' },
  templateUrl: './pitcher-game-log.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherGameLogComponent {
  readonly gameLogs = input.required<PitcherGameLog[]>();

  readonly expandedUrl = signal<string | null>(null);
  readonly colorCoding = signal(true);

  readonly gameLogViews = computed<GameLogView[]>(() => {
    const showColors = this.colorCoding();

    return [...this.gameLogs()]
      .filter((log) => log.totals.outs > 0)
      .reverse()
      .map((log) => ({
        url: log.url,
        date: log.date,
        opponent: log.opponent,
        formattedIP: fmtIP(log.totals.outs),
        totals: buildInningView(log.totals, showColors),
        innings: log.innings.map((inn) => buildInningView(inn, showColors)),
      }));
  });

  /** Game logs grouped by year, sorted descending */
  readonly yearGroups = computed<GameLogYearGroup[]>(() => {
    const views = this.gameLogViews();
    const groups = new Map<number, GameLogView[]>();

    views.forEach((view) => {
      const year = extractYear(view.date);
      const existing = groups.get(year);

      if (existing) {
        existing.push(view);
      } else {
        groups.set(year, [view]);
      }
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, games]) => ({ year, games }));
  });

  readonly hasMultipleYears = computed(() => this.yearGroups().length > 1);

  toggleExpand(url: string): void {
    this.expandedUrl.update((current) => (current === url ? null : url));
  }
}
