import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CellValuePipe } from '@ws/core/ui';

import type { StatColumn } from './stat-column';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatRow = Record<string, any>;

@Component({
  selector: 'ws-stats-table',
  standalone: true,
  imports: [CellValuePipe],
  host: { class: 'block overflow-x-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="w-full min-w-[700px] border-collapse text-sm">
      <thead>
        <tr class="border-border-dim border-b text-left">
          <th
            class="text-content-muted sticky left-0 bg-surface-base px-2 py-1.5 text-xs font-medium"
          >
            #
          </th>
          <th
            class="text-content-muted sticky left-8 bg-surface-base px-2 py-1.5 text-xs font-medium"
          >
            Name
          </th>
          @for (col of columns(); track col.key) {
            <th
              class="text-content-muted px-2 py-1.5 text-right text-xs font-medium"
            >
              {{ col.label }}
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of players(); track row['name']) {
          <tr
            class="border-border-dim hover:bg-surface-elevated border-b transition-colors"
          >
            <td
              class="text-content-dim sticky left-0 bg-surface-base px-2 py-1.5 text-xs"
            >
              {{ row['jerseyNumber'] ?? '' }}
            </td>
            <td
              class="text-content-bright sticky left-8 bg-surface-base px-2 py-1.5 font-medium whitespace-nowrap"
            >
              {{ row['name'] }}
            </td>
            @for (col of columns(); track col.key) {
              <td class="px-2 py-1.5 text-right tabular-nums">
                {{ row | cellValue: col }}
              </td>
            }
          </tr>
        }
      </tbody>
      @if (totals() || opponents()) {
        <tfoot>
          @if (totals(); as t) {
            <tr
              class="border-border-dim bg-surface-elevated border-b font-semibold"
            >
              <td class="sticky left-0 bg-surface-elevated px-2 py-1.5"></td>
              <td
                class="text-content-bright sticky left-8 bg-surface-elevated px-2 py-1.5"
              >
                Totals
              </td>
              @for (col of columns(); track col.key) {
                <td class="px-2 py-1.5 text-right tabular-nums">
                  {{ t | cellValue: col }}
                </td>
              }
            </tr>
          }
          @if (opponents(); as o) {
            <tr class="border-border-dim bg-surface-elevated border-b">
              <td class="sticky left-0 bg-surface-elevated px-2 py-1.5"></td>
              <td
                class="text-content-muted sticky left-8 bg-surface-elevated px-2 py-1.5 font-medium"
              >
                Opponents
              </td>
              @for (col of columns(); track col.key) {
                <td
                  class="text-content-muted px-2 py-1.5 text-right tabular-nums"
                >
                  {{ o | cellValue: col }}
                </td>
              }
            </tr>
          }
        </tfoot>
      }
    </table>
  `,
})
export class StatsTable {
  readonly columns = input.required<StatColumn[]>();
  readonly players = input.required<StatRow[]>();
  readonly totals = input<StatRow | null>(null);
  readonly opponents = input<StatRow | null>(null);
}
