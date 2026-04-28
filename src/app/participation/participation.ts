import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RosterService, SoftballDataService } from '@ws/core/data';
import type { GameData, PlayerMetaMap, RosterEntry } from '@ws/core/models';
import { EmptyState, ErrorBanner, LoadingState, OpponentNamePipe } from '@ws/core/ui';
import { CURRENT_YEAR } from '@ws/core/util';
import { forkJoin } from 'rxjs';

interface GameColumn {
  label: string;
  suffix: string | null;
  date: string;
  opponent: string;
}

type SortKey = 'jersey' | 'name' | 'class' | 'gp';
type SortDir = 'asc' | 'desc';

const CLASS_ORDER: Record<string, number> = {
  'fy.': 0,
  freshman: 0,
  'so.': 1,
  sophomore: 1,
  'jr.': 2,
  junior: 2,
  'sr.': 3,
  senior: 3,
  'gr.': 4,
  graduate: 4,
};

const SORTED_COL = 'bg-brand-bg-subtle';
const SORTED_HEADER = 'bg-brand-bg';

interface ParticipationRow {
  name: string;
  displayName: string;
  jersey: number;
  classYear: string;
  coachId: string | null;
  eligibilityUsed: boolean | null;
  fallTournament: boolean | null;
  notes: string | null;
  participated: boolean[];
  gamesPlayed: number;
}

@Component({
  selector: 'ws-participation',
  standalone: true,
  imports: [EmptyState, ErrorBanner, LoadingState, OpponentNamePipe],
  templateUrl: './participation.html',
  host: { class: 'block stats-section' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Participation {
  private readonly dataService = inject(SoftballDataService);
  private readonly rosterService = inject(RosterService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly games = signal<GameData[]>([]);
  readonly playerMeta = signal<PlayerMetaMap>({});

  readonly gameColumns = computed<GameColumn[]>(() => {
    const games = this.games();

    // Count occurrences of each opponent to detect doubleheaders
    const opponentCounts = new Map<string, number>();
    games.forEach((g) => {
      const opp = g.opponent ?? 'Unknown';
      opponentCounts.set(opp, (opponentCounts.get(opp) ?? 0) + 1);
    });

    // Build labels, adding (1)/(2) for doubleheaders
    const opponentIndex = new Map<string, number>();

    return games.map((g) => {
      const opp = g.opponent ?? 'Unknown';
      const count = opponentCounts.get(opp) ?? 1;
      const date = this.formatShortDate(g.date);

      if (count > 1) {
        const idx = (opponentIndex.get(opp) ?? 0) + 1;
        opponentIndex.set(opp, idx);

        return { label: opp, suffix: `(${idx})`, date, opponent: opp };
      }

      return { label: opp, suffix: null, date, opponent: opp };
    });
  });

  readonly rows = computed<ParticipationRow[]>(() => {
    const roster = this.rosterService.wellesleyRoster();
    const meta = this.playerMeta();
    const games = this.games();

    if (!roster) {
      return [];
    }

    // Build participation sets per game
    const gameSets = games.map((g) => {
      const players = new Set<string>();
      g.lineup.forEach((names) => {
        names.forEach((n) => players.add(n));
      });

      return players;
    });

    return Object.entries(roster)
      .map(([name, entry]: [string, RosterEntry]) => {
        const m = meta[entry.jersey];
        const participated = gameSets.map((set) => set.has(name));

        return {
          name,
          displayName: this.formatRosterName(name),
          jersey: entry.jersey,
          classYear: entry.classYear,
          coachId: m?.coachId ?? null,
          eligibilityUsed: m?.eligibilityUsed ?? null,
          fallTournament: m?.fallTournament ?? null,
          notes: m?.notes ?? null,
          participated,
          gamesPlayed: participated.filter(Boolean).length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly sortKey = signal<SortKey>('jersey');
  readonly sortDir = signal<SortDir>('asc');

  readonly SORTED_COL = SORTED_COL;
  readonly SORTED_HEADER = SORTED_HEADER;

  readonly sortedRows = computed<ParticipationRow[]>(() => {
    const rows = [...this.rows()];
    const key = this.sortKey();
    const dir = this.sortDir();
    const mul = dir === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      switch (key) {
        case 'jersey':
          return (a.jersey - b.jersey) * mul;
        case 'name':
          return a.name.localeCompare(b.name) * mul;
        case 'class':
          return ((CLASS_ORDER[a.classYear.toLowerCase()] ?? 99) - (CLASS_ORDER[b.classYear.toLowerCase()] ?? 99)) * mul;
        case 'gp':
          return (a.gamesPlayed - b.gamesPlayed) * mul;
      }
    });

    return rows;
  });

  constructor() {
    this.loadData();
  }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'gp' || key === 'class' ? 'desc' : 'asc');
    }
  }

  /** "jones, giana" → "Jones, Giana" */
  private formatRosterName(name: string): string {
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** "3/17/2026" → "03/17" */
  private formatShortDate(date?: string): string {
    if (!date) {
      return '';
    }

    const parts = date.split('/');

    if (parts.length < 2) {
      return date;
    }

    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      games: this.dataService.getGameData(CURRENT_YEAR),
      meta: this.dataService.fetchJson<PlayerMetaMap>('data/player-meta.json').then(
        (data) => data,
        () => ({}) as PlayerMetaMap
      ),
    }).subscribe({
      next: ({ games, meta }) => {
        this.games.set(games);
        this.playerMeta.set(meta);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load participation data');
        this.loading.set(false);
      },
    });
  }
}
