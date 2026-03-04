import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SoftballDataService, SoftballStatsService } from '@ws/core/data';
import {
  type Roster,
  type SprayChartSummary,
  type SprayDataPoint,
  type SprayZone,
} from '@ws/core/models';
import {
  buildDisplayJerseyMap,
  canonicalizeSprayNames,
  computeSprayZones,
  parseSprayData,
} from '@ws/core/processors';
import {
  ALL_CONTACT_QUALITIES,
  ALL_CONTACT_TYPES,
  ALL_OUT_COUNTS,
  ALL_OUTCOMES,
  ButtonToggle,
  computeEffectiveFilters,
  SprayField,
  SprayFilters,
  type SprayFilterState,
  SprayLegend,
  SprayYearPanel,
  type ToggleOption,
} from '@ws/core/ui';
import { BreakpointService } from '@ws/core/util';
import { catchError, forkJoin, of } from 'rxjs';

const CURRENT_YEAR = new Date().getFullYear();
const SPRAY_YEARS = Array.from(
  { length: 4 },
  (_, i) => CURRENT_YEAR - i
).reverse();

const VIEW_MODE_OPTIONS: ToggleOption[] = [
  { value: 'split', label: 'Split' },
  { value: 'combined', label: 'Combined' },
];

const YEAR_OPTIONS: ToggleOption[] = SPRAY_YEARS.map((y) => ({
  value: String(y),
  label: String(y),
}));

@Component({
  selector: 'ws-spray-chart',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ButtonToggle,
    SprayField,
    SprayFilters,
    SprayLegend,
    SprayYearPanel,
  ],
  templateUrl: './spray-chart.html',
  host: {
    class: 'flex flex-1 flex-col overflow-hidden',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayChart {
  private statsService = inject(SoftballStatsService);
  private dataService = inject(SoftballDataService);
  readonly bp = inject(BreakpointService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dataByYear = signal<Map<number, SprayDataPoint[]>>(new Map());
  private readonly rawRoster = signal<Roster>({});

  readonly viewMode = signal<'split' | 'combined'>('split');
  readonly selectedYears = signal<string[]>(SPRAY_YEARS.map(String));
  readonly viewModeOptions = VIEW_MODE_OPTIONS;
  readonly yearOptions = YEAR_OPTIONS;

  readonly filters = signal<SprayFilterState>({
    playerName: null,
    outcomes: [...ALL_OUTCOMES],
    contactTypes: [...ALL_CONTACT_TYPES],
    contactQualities: [...ALL_CONTACT_QUALITIES],
    outCount: [...ALL_OUT_COUNTS],
    risp: null,
  });

  readonly highlightZone = signal<SprayZone | null>(null);

  readonly players = computed(() => {
    const map = this.dataByYear();

    return Array.from(
      new Set(
        SPRAY_YEARS.flatMap((y) => (map.get(y) ?? []).map((p) => p.playerName))
      )
    ).sort();
  });

  readonly jerseyMap = computed(() =>
    buildDisplayJerseyMap(this.rawRoster(), this.players())
  );

  readonly rosteredPlayers = computed(() => {
    const map = this.jerseyMap();

    return this.players()
      .filter((p) => map[p] !== undefined)
      .sort((a, b) => map[a] - map[b]);
  });

  readonly nonRosteredPlayers = computed(() =>
    this.players().filter((p) => this.jerseyMap()[p] === undefined)
  );

  private readonly effectiveFilters = computed(() =>
    computeEffectiveFilters(this.filters())
  );

  readonly summaryByYear = computed(() => {
    const map = this.dataByYear();
    const ef = this.effectiveFilters();

    return new Map(
      SPRAY_YEARS.map(
        (y) => [y, computeSprayZones(map.get(y) ?? [], ef)] as const
      )
    );
  });

  readonly activeYears = computed(() =>
    SPRAY_YEARS.filter(
      (y) => (this.summaryByYear().get(y)?.totalContact ?? 0) > 0
    )
  );

  readonly combinedSummary = computed<SprayChartSummary>(() =>
    computeSprayZones(
      this.selectedYears().flatMap(
        (y) => this.dataByYear().get(Number(y)) ?? []
      ),
      this.effectiveFilters()
    )
  );

  constructor() {
    this.loadData();
  }

  onPlayerChange(player: string): void {
    this.onFilterChange({
      ...this.filters(),
      playerName: player === '' ? null : player,
    });
  }

  onFilterChange(newFilters: SprayFilterState): void {
    this.filters.set(newFilters);
  }

  onViewModeChange(value: string[] | string): void {
    this.viewMode.set(value as 'split' | 'combined');
  }

  onYearChange(values: string[] | string): void {
    this.selectedYears.set(values as string[]);
  }

  onZoneHover(zone: SprayZone | null): void {
    this.highlightZone.set(zone);
  }

  onZoneClick(_zone: SprayZone): void {
    // Future: could show zone detail panel
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dataByYear.set(new Map());

    forkJoin({
      roster: this.dataService
        .getRoster()
        .pipe(catchError(() => of({} as Roster))),
      years: forkJoin(
        SPRAY_YEARS.map((year) =>
          this.statsService.getStats(year).pipe(catchError(() => of(null)))
        )
      ),
    }).subscribe({
      next: ({ roster, years }) => {
        this.rawRoster.set(roster);

        const map = new Map<number, SprayDataPoint[]>();
        years.forEach((stats, i) => {
          if (!stats) {
            return;
          }

          map.set(
            SPRAY_YEARS[i],
            stats.games.flatMap((game, gi) =>
              parseSprayData(game.snapshots, gi)
            )
          );
        });

        canonicalizeSprayNames(map, SPRAY_YEARS, roster);
        this.dataByYear.set(map);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err.message || 'An error occurred while loading spray chart data'
        );
        this.loading.set(false);
      },
    });
  }
}
