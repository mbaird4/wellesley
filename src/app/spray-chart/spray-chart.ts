import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SoftballDataService, SoftballStatsService } from '@ws/core/data';
import { type Roster, type SprayDataPoint } from '@ws/core/models';
import { canonicalizeSprayNames, parseSprayData } from '@ws/core/processors';
import { LastUpdatedPipe, SPRAY_YEARS, SprayChartViewer } from '@ws/core/ui';
import { catchError, forkJoin, of } from 'rxjs';

@Component({
  selector: 'ws-spray-chart',
  standalone: true,
  imports: [
    LastUpdatedPipe,
    SprayChartViewer,
  ],
  template: `
    @if (scrapedAt()) {
      <div class="mb-2 flex">
        <span class="text-content-dim text-xs">
          {{ scrapedAt() | lastUpdated }}
        </span>
      </div>
    }
    <ws-spray-chart-viewer [dataByYear]="dataByYear()" [roster]="roster()" [loading]="loading()" [error]="error()" />
  `,
  host: { class: 'block stats-section' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayChart {
  private statsService = inject(SoftballStatsService);
  private dataService = inject(SoftballDataService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly scrapedAt = signal<string | null>(null);
  readonly dataByYear = signal<Map<number, SprayDataPoint[]>>(new Map());
  readonly roster = signal<Roster>({});

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    const currentYear = SPRAY_YEARS[0];

    forkJoin({
      roster: this.dataService.getRoster().pipe(catchError(() => of({} as Roster))),
      scrapedAt: this.dataService.getScrapedAt(currentYear).pipe(catchError(() => of(''))),
      years: forkJoin(SPRAY_YEARS.map((year) => this.statsService.getStats(year).pipe(catchError(() => of(null))))),
    }).subscribe({
      next: ({ roster, scrapedAt, years }) => {
        this.scrapedAt.set(scrapedAt || null);
        this.roster.set(roster);

        const map = new Map<number, SprayDataPoint[]>();
        years.forEach((stats, i) => {
          if (!stats) {
            return;
          }

          map.set(
            SPRAY_YEARS[i],
            stats.games.flatMap((game, gi) => parseSprayData(game.snapshots, gi))
          );
        });

        canonicalizeSprayNames(map, SPRAY_YEARS, roster);
        this.dataByYear.set(map);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'An error occurred while loading spray chart data');
        this.loading.set(false);
      },
    });
  }
}
