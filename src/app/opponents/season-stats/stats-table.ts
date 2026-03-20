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
  templateUrl: './stats-table.html',
})
export class StatsTable {
  readonly columns = input.required<StatColumn[]>();
  readonly players = input.required<StatRow[]>();
  readonly totals = input<StatRow | null>(null);
  readonly opponents = input<StatRow | null>(null);
  readonly defaultSortKey = input<string | null>(null);
  readonly defaultSortDir = input<SortDir>('desc');

  readonly minPa = input(0);

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

  readonly qualifiedPlayers = computed(() => {
    const min = this.minPa();

    if (min <= 0) {
      return this.sortedPlayers();
    }

    return this.sortedPlayers().filter((r) => this.rowPa(r) >= min);
  });

  readonly unqualifiedPlayers = computed(() => {
    const min = this.minPa();

    if (min <= 0) {
      return [];
    }

    return this.sortedPlayers().filter((r) => this.rowPa(r) < min);
  });

  private rowPa(row: StatRow): number {
    return Number(row['ab'] ?? 0) + Number(row['bb'] ?? 0) + Number(row['hbp'] ?? 0) + Number(row['sf'] ?? 0) + Number(row['sh'] ?? 0);
  }

  sortBy(key: string): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'name' ? 'asc' : 'desc');
    }
  }
}
