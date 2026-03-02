import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { JerseyMap } from '@ws/data-access';
import { SoftballDataService, SoftballProcessorService } from '@ws/data-access';
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
import { BreakpointService } from '@ws/shared/util';
import type { SprayChartSummary, SprayDataPoint, SprayZone } from '@ws/stats-core';
import { computeSprayZones, parseSprayData } from '@ws/stats-core';

@Component({
  selector: 'ws-opponent-spray-chart',
  standalone: true,
  imports: [
    SprayField,
    SprayFilters,
    SprayLegend,
  ],
  templateUrl: './opponent-spray-chart.html',
  host: { class: 'flex flex-1 flex-col overflow-hidden' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpponentSprayChart {
  private dataService = inject(SoftballDataService);
  private processorService = inject(SoftballProcessorService);
  readonly bp = inject(BreakpointService);

  readonly slug = input.required<string>();
  readonly year = input(2025);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly allDataPoints = signal<SprayDataPoint[]>([]);
  private readonly rawRoster = signal<JerseyMap>({});

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
    const names = new Set(this.allDataPoints().map((p) => p.playerName));

    return Array.from(names).sort();
  });

  readonly rosteredPlayers = computed(() => {
    const map = this.jerseyMap();

    return this.players()
      .filter((p) => map[p] !== undefined)
      .sort((a, b) => map[a] - map[b]);
  });

  readonly nonRosteredPlayers = computed(() =>
    this.players().filter((p) => this.jerseyMap()[p] === undefined)
  );

  /** Map display names (e.g. "S. Moore") → jersey numbers by matching last name */
  readonly jerseyMap = computed(() => {
    const roster = this.rawRoster();
    const map: JerseyMap = {};

    // Build last-name lookup from roster: "moore" → 7
    const byLastName = new Map<string, number>();
    Object.entries(roster).forEach(([key, num]) => {
      const last = key.split(',')[0].trim();
      byLastName.set(last, num);
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
          if (rosterLast.startsWith(displayLast) || displayLast.startsWith(rosterLast)) {
            map[displayName] = num;
            break;
          }
        }
      }
    });

    return map;
  });

  readonly summary = computed<SprayChartSummary>(() => {
    const f = this.filters();
    const allowedContacts = computeAllowedContacts(f);
    const allowedOutcomes = computeAllowedOutcomes(f);
    const effectiveContactTypes = f.contactTypes.filter((ct) => allowedContacts.has(ct));
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
    effect(() => {
      const slug = this.slug();
      const year = this.year();
      this.loadData(slug, year);
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

  private loadData(slug: string, year: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.allDataPoints.set([]);
    this.rawRoster.set({});
    this.filters.set({
      playerName: null,
      outcomes: [...ALL_OUTCOMES],
      contactTypes: [...ALL_CONTACT_TYPES],
      contactQualities: [...ALL_CONTACT_QUALITIES],
      outCount: [...ALL_OUT_COUNTS],
      risp: null,
    });

    this.dataService.getOpponentRoster(slug).subscribe({
      next: (map) => this.rawRoster.set(map),
    });

    this.dataService.getOpponentGameData(slug, year).subscribe({
      next: (games) => {
        const processed = this.processorService.processGamesWithSnapshots(games);
        const points = processed.games.flatMap((game, i) =>
          parseSprayData(game.snapshots, i)
        );
        this.allDataPoints.set(points);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err.message || 'Failed to load spray chart data'
        );
        this.loading.set(false);
      },
    });
  }
}
