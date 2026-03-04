import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { SoftballDataService, SoftballProcessorService } from '@ws/core/data';
import { type Roster, type SprayDataPoint } from '@ws/core/models';
import { canonicalizeSprayNames, parseSprayData } from '@ws/core/processors';
import { SPRAY_YEARS, SprayChartViewer } from '@ws/core/ui';
import { catchError, forkJoin, of } from 'rxjs';

@Component({
  selector: 'ws-opponent-spray-chart',
  standalone: true,
  imports: [SprayChartViewer],
  template: `
    <ws-spray-chart-viewer
      [dataByYear]="dataByYear()"
      [roster]="roster()"
      [loading]="loading()"
      [error]="error()"
      [includeUnmatchedRoster]="true"
      emptyMessage="No spray chart data available for this team."
    />
  `,
  host: { class: 'flex flex-1 flex-col overflow-hidden' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpponentSprayChart {
  private dataService = inject(SoftballDataService);
  private processorService = inject(SoftballProcessorService);

  readonly slug = input.required<string>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dataByYear = signal<Map<number, SprayDataPoint[]>>(new Map());
  readonly roster = signal<Roster>({});

  constructor() {
    effect(() => {
      const slug = this.slug();
      this.loadData(slug);
    });
  }

  private loadData(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.dataByYear.set(new Map());
    this.roster.set({});

    forkJoin({
      roster: this.dataService
        .getOpponentRoster(slug)
        .pipe(catchError(() => of({} as Roster))),
      years: forkJoin(
        SPRAY_YEARS.map((year) =>
          this.dataService
            .getOpponentGameData(slug, year)
            .pipe(catchError(() => of([])))
        )
      ),
    }).subscribe({
      next: ({ roster, years }) => {
        this.roster.set(roster);

        const map = new Map<number, SprayDataPoint[]>();
        years.forEach((games, i) => {
          const processed =
            this.processorService.processGamesWithSnapshots(games);
          const points = processed.games.flatMap((game, gi) =>
            parseSprayData(game.snapshots, gi)
          );
          map.set(SPRAY_YEARS[i], points);
        });

        canonicalizeSprayNames(map, SPRAY_YEARS, roster);
        this.dataByYear.set(map);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load spray chart data');
        this.loading.set(false);
      },
    });
  }
}
