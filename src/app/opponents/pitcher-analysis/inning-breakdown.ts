import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { SlideToggle } from '@ws/shared/ui';
import type { PitcherInningStats } from '@ws/stats-core';
import {
  battingAvgAgainst,
  inningToNumber,
  wobaAgainst,
  wobaColorStyle,
} from '@ws/stats-core';

import type { InningsTableRow, InningsTotalsRow } from './pitcher-innings-table';
import { PitcherInningsTable } from './pitcher-innings-table';

const EMPTY_STYLE: Record<string, string> = {};

function fmtStat(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

@Component({
  selector: 'ws-inning-breakdown',
  standalone: true,
  imports: [
    SlideToggle,
    PitcherInningsTable,
  ],
  host: { class: 'block' },
  templateUrl: './inning-breakdown.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InningBreakdown {
  readonly byInning = input.required<Map<string, PitcherInningStats>>();
  readonly totals = input.required<PitcherInningStats>();

  readonly colorCoding = signal(true);

  readonly inningRows = computed<InningsTableRow[]>(() => {
    const showColors = this.colorCoding();
    const entries = Array.from(this.byInning().values()).sort(
      (a, b) => inningToNumber(a.inning) - inningToNumber(b.inning)
    );

    return entries.map((inn) => {
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
    });
  });

  readonly totalsRow = computed<InningsTotalsRow>(() => {
    const t = this.totals();
    const showColors = this.colorCoding();
    const avg = battingAvgAgainst(t);
    const woba = wobaAgainst(t);

    return {
      battersFaced: t.battersFaced,
      hits: t.hits,
      runs: t.runs,
      strikeouts: t.strikeouts,
      walks: t.walks,
      formattedAvg: fmtStat(avg),
      formattedWoba: fmtStat(woba),
      avgStyle: showColors ? wobaColorStyle(0.55 - avg * 1.2) : EMPTY_STYLE,
      wobaStyle: showColors ? wobaColorStyle(0.55 - woba) : EMPTY_STYLE,
    };
  });
}
