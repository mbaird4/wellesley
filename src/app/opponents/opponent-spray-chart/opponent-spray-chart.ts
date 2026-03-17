import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RosterService, SoftballDataService, SoftballProcessorService } from '@ws/core/data';
import { type GameData, type Roster, type SprayDataPoint, type Team } from '@ws/core/models';
import { canonicalizeSprayNames, parseSprayData } from '@ws/core/processors';
import { SPRAY_YEARS, SprayChartViewer } from '@ws/core/ui';
import { catchError, forkJoin, of } from 'rxjs';

@Component({
  selector: 'ws-opponent-spray-chart',
  standalone: true,
  imports: [SprayChartViewer],
  template: ` <ws-spray-chart-viewer [dataByYear]="dataByYear()" [roster]="roster()" [teamData]="teamData()" [lineupOrder]="lineupOrder()" [loading]="loading()" [error]="error()" [printTitle]="teamName()" emptyMessage="No spray chart data available for this team." /> `,
  host: {
    class: 'block',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpponentSprayChart {
  private dataService = inject(SoftballDataService);
  private processorService = inject(SoftballProcessorService);
  private rosterService = inject(RosterService);

  readonly slug = input.required<string>();
  readonly dataDir = input<string>('');
  readonly teamName = input('');
  readonly teamData = input<Team | null>(null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dataByYear = signal<Map<number, SprayDataPoint[]>>(new Map());
  readonly roster = signal<Roster>({});
  readonly lineupOrder = signal<Record<string, number>>({});

  constructor() {
    effect(() => {
      const slug = this.slug();
      this.loadData(slug);
    });
  }

  private loadData(slug: string): void {
    const dir = this.dataDir() || slug;
    this.loading.set(true);
    this.error.set(null);
    this.dataByYear.set(new Map());
    this.roster.set({});
    this.lineupOrder.set({});

    forkJoin({
      roster: this.dataService.getOpponentRoster(dir).pipe(catchError(() => of({} as Roster))),
      years: forkJoin(SPRAY_YEARS.map((year) => this.dataService.getOpponentGameData(dir, year).pipe(catchError(() => of([]))))),
    }).subscribe({
      next: ({ roster, years }) => {
        this.roster.set(roster);

        const map = new Map<number, SprayDataPoint[]>();
        years.forEach((games, i) => {
          const processed = this.processorService.processGamesWithSnapshots(games);
          const points = processed.games.flatMap((game, gi) => parseSprayData(game.snapshots, gi));
          map.set(SPRAY_YEARS[i], points);
        });

        canonicalizeSprayNames(map, SPRAY_YEARS, roster);
        this.dataByYear.set(map);

        // Compute likely lineup from the most recent year with game data
        const mostRecentGames = [...years].reverse().find((g) => g.length > 0) ?? [];
        this.lineupOrder.set(this.buildLineupOrder(mostRecentGames));

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load spray chart data');
        this.loading.set(false);
      },
    });
  }

  /**
   * Analyze lineup data across games to find the most likely starter at each slot.
   * Returns a map of display name → lineup slot (1–9).
   */
  private buildLineupOrder(games: GameData[]): Record<string, number> {
    if (games.length === 0) {
      return {};
    }

    // Count how many games each player starts at each slot
    const slotCounts = new Map<string, Map<number, number>>();

    games.forEach((game) => {
      game.lineup.forEach((names, slot) => {
        if (slot > 9 || names.length === 0) {
          return;
        }

        const starter = this.rosterService.abbreviateName(names[0]);

        const existing = slotCounts.get(starter) ?? new Map<number, number>();

        if (!slotCounts.has(starter)) {
          slotCounts.set(starter, existing);
        }

        existing.set(slot, (existing.get(slot) ?? 0) + 1);
      });
    });

    // For each player, find their most common slot
    const playerBestSlot: { name: string; slot: number; count: number }[] = [];

    slotCounts.forEach((slots, name) => {
      let bestSlot = 0;
      let bestCount = 0;

      slots.forEach((count, slot) => {
        if (count > bestCount) {
          bestSlot = slot;
          bestCount = count;
        }
      });

      playerBestSlot.push({ name, slot: bestSlot, count: bestCount });
    });

    // Sort by slot, then by frequency desc
    playerBestSlot.sort((a, b) => a.slot - b.slot || b.count - a.count);

    // Assign one player per slot — highest frequency wins
    const usedSlots = new Set<number>();
    const result: Record<string, number> = {};

    playerBestSlot.forEach(({ name, slot }) => {
      if (!usedSlots.has(slot)) {
        usedSlots.add(slot);
        result[name] = slot;
      }
    });

    return result;
  }
}
