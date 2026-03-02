import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface InningsTableRow {
  inning: string;
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

export interface InningsTotalsRow {
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

@Component({
  selector: 'ws-pitcher-innings-table',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './pitcher-innings-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherInningsTable {
  readonly rows = input.required<InningsTableRow[]>();
  readonly totals = input<InningsTotalsRow | null>(null);
  /** When false (default), table has its own border and rounded-t-none styling.
   *  When true, border and rounding are suppressed — use when the table sits
   *  inside a card container that provides its own visual chrome. */
  readonly bordered = input(true);
}
