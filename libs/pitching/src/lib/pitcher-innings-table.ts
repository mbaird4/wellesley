import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { InningsTableRow, InningsTotalsRow } from '@ws/core/models';

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
