import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { JerseyMap, Roster } from '@ws/data-access';
import {
  SoftballDataService,
  SoftballStatsService,
  toJerseyMap,
} from '@ws/data-access';
import {
  ALL_CONTACT_QUALITIES,
  ALL_CONTACT_TYPES,
  ALL_OUT_COUNTS,
  ALL_OUTCOMES,
  computeAllowedContacts,
  computeAllowedOutcomes,
  SprayField,
  SprayFilters,
  type SprayFilterState,
  SprayLegend,
} from '@ws/shared/ui';
import type {
  SprayChartSummary,
  SprayDataPoint,
  SprayZone,
} from '@ws/stats-core';
import {
  buildCanonicalNameMap,
  computeSprayZones,
  normalizePlayerName,
  parseSprayData,
} from '@ws/stats-core';
import { catchError, forkJoin, of } from 'rxjs';

@Component({
  selector: 'ws-spray-chart',
  standalone: true,
  imports: [
    FormsModule,
    SprayField,
    SprayFilters,
    SprayLegend,
  ],
  templateUrl: './spray-chart.html',
  host: {
    class: 'flex flex-col overflow-hidden',
    style: 'height: calc(100vh - 140px)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayChart {
  private statsService = inject(SoftballStatsService);
  private dataService = inject(SoftballDataService);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  error: string | null = null;
  selectedYear = 2025;
  availableYears = [
    2025, 2024, 2023, 2022, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012,
    2011,
  ];

  // Raw spray data from all games
  allDataPoints = signal<SprayDataPoint[]>([]);
  private rawRoster = signal<Roster>({});

  // Filter state
  filters = signal<SprayFilterState>({
    playerName: null,
    outcomes: [...ALL_OUTCOMES],
    contactTypes: [...ALL_CONTACT_TYPES],
    contactQualities: [...ALL_CONTACT_QUALITIES],
    outCount: [...ALL_OUT_COUNTS],
    risp: null,
  });

  highlightZone = signal<SprayZone | null>(null);

  // Available players (derived from data)
  players = computed(() => {
    const names = new Set(this.allDataPoints().map((p) => p.playerName));

    return Array.from(names).sort();
  });

  rosteredPlayers = computed(() => {
    const map = this.jerseyMap();

    return this.players()
      .filter((p) => map[p] !== undefined)
      .sort((a, b) => map[a] - map[b]);
  });

  nonRosteredPlayers = computed(() =>
    this.players().filter((p) => this.jerseyMap()[p] === undefined)
  );

  /** Map display names (e.g. "S. Moore") → jersey numbers by matching last name */
  jerseyMap = computed(() => {
    const roster = this.rawRoster();
    const map: JerseyMap = {};

    // Build last-name lookup from roster: "moore" → 7
    const byLastName = new Map<string, number>();
    Object.entries(roster).forEach(([key, entry]) => {
      const last = key.split(',')[0].trim();
      byLastName.set(last, entry.jersey);
    });

    this.players().forEach((displayName) => {
      // Display names are like "S. Moore" or "A. Hadjipana"
      const parts = displayName.split(/\s+/);
      const displayLast = parts.slice(1).join(' ').toLowerCase();
      const jersey = byLastName.get(displayLast);

      if (jersey !== undefined) {
        map[displayName] = jersey;
      } else {
        // Try prefix match for truncated names (e.g. "DiCampell" vs "dicampello")
        for (const [rosterLast, num] of byLastName) {
          if (
            rosterLast.startsWith(displayLast) ||
            displayLast.startsWith(rosterLast)
          ) {
            map[displayName] = num;
            break;
          }
        }
      }
    });

    return map;
  });

  // Filtered + aggregated summary
  summary = computed<SprayChartSummary>(() => {
    const f = this.filters();
    const allowedContacts = computeAllowedContacts(f);
    const allowedOutcomes = computeAllowedOutcomes(f);
    const effectiveContactTypes = f.contactTypes.filter((ct) =>
      allowedContacts.has(ct)
    );
    const effectiveOutcomes = f.outcomes.filter((o) => allowedOutcomes.has(o));

    return computeSprayZones(this.allDataPoints(), {
      playerName: f.playerName,
      outcomes: effectiveOutcomes,
      contactTypes: effectiveContactTypes,
      contactQualities: f.contactQualities,
      outCount: f.outCount,
      risp: f.risp ?? undefined,
    });
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.allDataPoints.set([]);

    forkJoin({
      stats: this.statsService.getStats(this.selectedYear),
      roster: this.dataService
        .getRoster()
        .pipe(catchError(() => of({} as Roster))),
    }).subscribe({
      next: ({ stats, roster }) => {
        this.rawRoster.set(roster);

        const points = stats.games.flatMap((game, i) =>
          parseSprayData(game.snapshots, i)
        );

        // Normalize full first names → initials ("Joe Smith" → "J. Smith")
        points.forEach(
          (p) => (p.playerName = normalizePlayerName(p.playerName))
        );

        // Merge truncated last names and wrong initials using jersey numbers
        if (Object.keys(roster).length > 0) {
          const allNames = [...new Set(points.map((p) => p.playerName))];
          const canonMap = buildCanonicalNameMap(allNames, toJerseyMap(roster));

          if (canonMap.size > 0) {
            points.forEach((p) => {
              const canon = canonMap.get(p.playerName);

              if (canon) {
                p.playerName = canon;
              }
            });
          }
        }

        this.allDataPoints.set(points);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error =
          err.message || 'An error occurred while loading spray chart data';
        this.loading = false;
        console.error('Error loading spray chart data:', err);
        this.cdr.markForCheck();
      },
    });
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

  onZoneHover(zone: SprayZone | null): void {
    this.highlightZone.set(zone);
  }

  onZoneClick(_zone: SprayZone): void {
    // Future: could show zone detail panel
  }

  onYearChange(): void {
    this.filters.set({
      playerName: null,
      outcomes: [...ALL_OUTCOMES],
      contactTypes: [...ALL_CONTACT_TYPES],
      contactQualities: [...ALL_CONTACT_QUALITIES],
      outCount: [...ALL_OUT_COUNTS],
      risp: null,
    });
    this.loadData();
  }
}
