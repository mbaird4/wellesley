import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import type { PitcherGameLog, PitcherInningStats } from '@ws/stats-core';
import {
  battingAvgAgainst,
  wobaAgainst,
  wobaGradientStyle,
} from '@ws/stats-core';
import { SlideToggle } from '@ws/shared/ui';
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

function buildInningView(
  inn: PitcherInningStats,
  showColors: boolean
): InningsTableRow {
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
    avgStyle: showColors ? wobaGradientStyle(0.55 - avg * 1.2) : EMPTY_STYLE,
    wobaStyle: showColors ? wobaGradientStyle(0.55 - woba) : EMPTY_STYLE,
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

@Component({
  selector: 'ws-pitcher-game-log',
  standalone: true,
  imports: [SlideToggle, PitcherInningsTable],
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

    return this.gameLogs().map((log) => ({
      url: log.url,
      date: log.date,
      opponent: log.opponent,
      formattedIP: fmtIP(log.totals.outs),
      totals: buildInningView(log.totals, showColors),
      innings: log.innings.map((inn) => buildInningView(inn, showColors)),
    }));
  });

  toggleExpand(url: string): void {
    this.expandedUrl.update((current) => (current === url ? null : url));
  }
}
