import { afterNextRender, ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CellValuePipe } from '@ws/core/ui';

import type { StatColumn } from './stat-column';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatRow = Record<string, any>;

type SortDir = 'asc' | 'desc';

const SORTED_COL = 'bg-brand-bg-subtle';
const SORTED_HEADER = 'bg-brand-bg';

@Component({
  selector: 'ws-stats-table',
  standalone: true,
  imports: [CellValuePipe],
  host: { class: 'block overflow-x-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="stats-table season-stats-table mb-0! w-full rounded-none! border-0!">
      <thead>
        <tr>
          <th class="sticky-col hover:text-content-bright cursor-pointer select-none" [class]="sortKey() === '#' ? SORTED_HEADER : ''" (click)="sortBy('#')">
            #
            <span class="inline-block w-[0.6rem] text-center text-[0.6rem]" [class.invisible]="sortKey() !== '#'">
              {{ sortDir() === 'asc' ? '&#9650;' : '&#9660;' }}
            </span>
          </th>
          <th class="sticky-col-name hover:text-content-bright cursor-pointer select-none" [class]="sortKey() === 'name' ? SORTED_HEADER : ''" (click)="sortBy('name')">
            Name
            <span class="inline-block w-[0.6rem] text-center text-[0.6rem]" [class.invisible]="sortKey() !== 'name'">
              {{ sortDir() === 'asc' ? '&#9650;' : '&#9660;' }}
            </span>
          </th>
          @for (col of columns(); track col.key) {
            <th class="hover:text-content-bright cursor-pointer select-none" [class]="sortKey() === col.key ? SORTED_HEADER : ''" (click)="sortBy(col.key)">
              {{ col.label }}
              <span class="inline-block w-[0.6rem] text-center text-[0.6rem]" [class.invisible]="sortKey() !== col.key">
                {{ sortDir() === 'asc' ? '&#9650;' : '&#9660;' }}
              </span>
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of sortedPlayers(); track row['name']) {
          <tr>
            <td class="sticky-col text-content-dim text-xs" [class]="sortKey() === '#' ? SORTED_COL : ''">
              {{ row['jerseyNumber'] ?? '' }}
            </td>
            <td class="sticky-col-name whitespace-nowrap" [class]="sortKey() === 'name' ? SORTED_COL : ''">
              {{ row['name'] }}
            </td>
            @for (col of columns(); track col.key) {
              <td [class]="sortKey() === col.key ? SORTED_COL : ''">
                {{ row | cellValue: col }}
              </td>
            }
          </tr>
        }
      </tbody>
      @if (totals() || opponents()) {
        <tfoot>
          @if (totals(); as t) {
            <tr class="border-line border-t font-semibold">
              <td class="sticky-col"></td>
              <td class="sticky-col-name">Totals</td>
              @for (col of columns(); track col.key) {
                <td [class]="sortKey() === col.key ? SORTED_COL : ''">
                  {{ t | cellValue: col }}
                </td>
              }
            </tr>
          }
          @if (opponents(); as o) {
            <tr class="text-content-muted">
              <td class="sticky-col"></td>
              <td class="sticky-col-name font-medium">Opponents</td>
              @for (col of columns(); track col.key) {
                <td>{{ o | cellValue: col }}</td>
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
  readonly defaultSortKey = input<string | null>(null);
  readonly defaultSortDir = input<SortDir>('desc');

  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<SortDir>('desc');

  readonly SORTED_COL = SORTED_COL;
  readonly SORTED_HEADER = SORTED_HEADER;

  constructor() {
    afterNextRender(() => {
      const def = this.defaultSortKey();

      if (def) {
        this.sortKey.set(def);
        this.sortDir.set(this.defaultSortDir());
      }
    });
  }

  readonly sortedPlayers = computed(() => {
    const rows = [...this.players()];
    const key = this.sortKey();
    const dir = this.sortDir();

    if (!key) {
      return rows;
    }

    const mult = dir === 'asc' ? 1 : -1;

    if (key === 'name') {
      return rows.sort((a, b) => mult * String(a['name']).localeCompare(String(b['name'])));
    }

    if (key === '#') {
      return rows.sort((a, b) => mult * ((a['jerseyNumber'] ?? 999) - (b['jerseyNumber'] ?? 999)));
    }

    return rows.sort((a, b) => {
      const aVal = Number(a[key] ?? -1);
      const bVal = Number(b[key] ?? -1);

      return mult * (aVal - bVal);
    });
  });

  sortBy(key: string): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'name' ? 'asc' : 'desc');
    }
  }
}
