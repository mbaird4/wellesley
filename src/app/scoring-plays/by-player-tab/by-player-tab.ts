import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { FormatPlayTypePipe } from '@ws/core/ui';

interface PlayerScoringBreakdown {
  name: string;
  runsScored: number;
  rbis: number;
  scoredByType: Record<string, number>;
  rbiByType: Record<string, number>;
}

interface TypeBadge {
  key: string;
  value: number;
}

interface DisplayPlayer extends PlayerScoringBreakdown {
  topTypes: TypeBadge[];
  overflowCount: number;
}

type SortKey = 'name' | 'runs' | 'rbis';

const MAX_BADGES = 3;

@Component({
  selector: 'ws-by-player-tab',
  standalone: true,
  imports: [FormatPlayTypePipe],
  host: { class: 'flex flex-col' },
  templateUrl: './by-player-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ByPlayerTab {
  readonly selectedYear = input.required<number>();
  readonly players = input.required<PlayerScoringBreakdown[]>();
  readonly sortKey = signal<SortKey>('runs');
  readonly sortAsc = signal(false);

  readonly displayPlayers = computed<DisplayPlayer[]>(() => {
    const players = this.players();
    const key = this.sortKey();
    const asc = this.sortAsc();
    const mult = asc ? 1 : -1;

    const enriched = players.map((p) => {
      const entries = Object.entries(p.rbiByType)
        .map(([k, v]) => ({ key: k, value: v }))
        .sort((a, b) => b.value - a.value);

      return {
        ...p,
        topTypes: entries.slice(0, MAX_BADGES),
        overflowCount: Math.max(0, entries.length - MAX_BADGES),
      };
    });

    enriched.sort((a, b) => {
      switch (key) {
        case 'name':
          return mult * a.name.localeCompare(b.name);
        case 'runs':
          return mult * (a.runsScored - b.runsScored);
        case 'rbis':
          return mult * (a.rbis - b.rbis);
        default:
          return 0;
      }
    });

    return enriched;
  });

  sort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((v) => !v);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(key === 'name');
    }
  }
}
