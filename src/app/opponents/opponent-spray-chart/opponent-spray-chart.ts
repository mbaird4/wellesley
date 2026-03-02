import { NgTemplateOutlet } from '@angular/common';
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
  ButtonToggle,
  computeAllowedContacts,
  computeAllowedOutcomes,
  SprayField,
  SprayFilters,
  type SprayFilterState,
  SprayLegend,
  type ToggleOption,
} from '@ws/shared/ui';
import { BreakpointService } from '@ws/shared/util';
import type { SprayChartSummary, SprayDataPoint, SprayZone } from '@ws/stats-core';
import { computeSprayZones, parseSprayData } from '@ws/stats-core';
import { catchError, forkJoin, of } from 'rxjs';

import { SprayYearPanel } from '../spray-year-panel/spray-year-panel';

const SPRAY_YEARS = [2023, 2024, 2025];

/** Normalize "Joe Smith" → "J. Smith" so multi-year names merge correctly. */
function normalizePlayerName(name: string): string {
  const parts = name.split(/\s+/);

  if (parts.length < 2) {
    return name;
  }

  const first = parts[0];

  // Already initial format ("J." or "J")
  if (first.length <= 2) {
    return name;
  }

  const rest = parts.slice(1).join(' ');

  return `${first[0]}. ${rest}`;
}

/**
 * Build a rename map that merges truncated last names (e.g. "E. Santi" → "E. Santiago").
 * Groups names by jersey number + first initial; within each group, maps shorter
 * variants to the longest canonical form.
 */
function buildCanonicalNameMap(names: string[], roster: JerseyMap): Map<string, string> {
  const byLastName = new Map<string, number>();
  Object.entries(roster).forEach(([key, num]) => {
    const last = key.split(',')[0].trim();
    byLastName.set(last, num);
  });

  // Match each display name to a jersey number
  const nameToJersey = new Map<string, number>();
  names.forEach((displayName) => {
    const parts = displayName.split(/\s+/);
    const displayLast = parts.slice(1).join(' ').toLowerCase();
    const jersey = byLastName.get(displayLast);

    if (jersey !== undefined) {
      nameToJersey.set(displayName, jersey);

      return;
    }

    for (const [rosterLast, num] of byLastName) {
      if (rosterLast.startsWith(displayLast) || displayLast.startsWith(rosterLast)) {
        nameToJersey.set(displayName, num);
        break;
      }
    }
  });

  // Group by jersey number, then by first initial
  const byJersey = new Map<number, string[]>();
  nameToJersey.forEach((jersey, name) => {
    const group = byJersey.get(jersey) ?? [];
    group.push(name);
    byJersey.set(jersey, group);
  });

  const canonMap = new Map<string, string>();
  byJersey.forEach((group) => {
    if (group.length <= 1) {
      return;
    }

    // Sub-group by first initial
    const byInitial = new Map<string, string[]>();
    group.forEach((name) => {
      const initial = name[0];
      const sub = byInitial.get(initial) ?? [];
      sub.push(name);
      byInitial.set(initial, sub);
    });

    byInitial.forEach((sub) => {
      if (sub.length <= 1) {
        return;
      }

      // Longest name wins as the canonical form
      const canonical = sub.reduce((a, b) => (b.length > a.length ? b : a));
      sub.forEach((name) => {
        if (name !== canonical) {
          canonMap.set(name, canonical);
        }
      });
    });
  });

  return canonMap;
}

const VIEW_MODE_OPTIONS: ToggleOption[] = [
  { value: 'split', label: 'Split' },
  { value: 'combined', label: 'Combined' },
];

const YEAR_OPTIONS: ToggleOption[] = SPRAY_YEARS.map((y) => ({
  value: String(y),
  label: String(y),
}));

@Component({
  selector: 'ws-opponent-spray-chart',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ButtonToggle,
    SprayField,
    SprayFilters,
    SprayLegend,
    SprayYearPanel,
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

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dataByYear = signal<Map<number, SprayDataPoint[]>>(new Map());
  private readonly rawRoster = signal<JerseyMap>({});

  readonly viewMode = signal<'split' | 'combined'>('split');
  readonly selectedYears = signal<string[]>(SPRAY_YEARS.map(String));
  readonly viewModeOptions = VIEW_MODE_OPTIONS;
  readonly yearOptions = YEAR_OPTIONS;
  readonly sprayYears = SPRAY_YEARS;

  readonly filters = signal<SprayFilterState>({
    playerName: null,
    outcomes: [...ALL_OUTCOMES],
    contactTypes: [...ALL_CONTACT_TYPES],
    contactQualities: [...ALL_CONTACT_QUALITIES],
    outCount: [...ALL_OUT_COUNTS],
    risp: null,
  });

  readonly highlightZone = signal<SprayZone | null>(null);

  /** Union of all years' data points */
  readonly allDataPoints = computed(() => {
    const map = this.dataByYear();

    return SPRAY_YEARS.flatMap((y) => map.get(y) ?? []);
  });

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
      const parts = displayName.split(/\s+/);
      const displayLast = parts.slice(1).join(' ').toLowerCase();
      const jersey = byLastName.get(displayLast);

      if (jersey !== undefined) {
        map[displayName] = jersey;
      } else {
        // Try prefix match for truncated names
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

  /** Effective filters with cross-filter constraints applied */
  private readonly effectiveFilters = computed(() => {
    const f = this.filters();
    const allowedContacts = computeAllowedContacts(f);
    const allowedOutcomes = computeAllowedOutcomes(f);

    return {
      playerName: f.playerName,
      outcomes: f.outcomes.filter((o) => allowedOutcomes.has(o)),
      contactTypes: f.contactTypes.filter((ct) => allowedContacts.has(ct)),
      contactQualities: f.contactQualities,
      outCount: f.outCount,
      risp: f.risp ?? undefined,
    };
  });

  /** Per-year summaries for split mode */
  readonly summaryByYear = computed(() => {
    const map = this.dataByYear();
    const ef = this.effectiveFilters();
    const result = new Map<number, SprayChartSummary>();

    SPRAY_YEARS.forEach((year) => {
      const points = map.get(year) ?? [];
      result.set(year, computeSprayZones(points, ef));
    });

    return result;
  });

  /** Years that have data after filters are applied (skip empty years in split mode) */
  readonly activeYears = computed(() => {
    const summaries = this.summaryByYear();

    return SPRAY_YEARS.filter((y) => (summaries.get(y)?.totalContact ?? 0) > 0);
  });

  /** Combined summary merging selected years for combined mode */
  readonly combinedSummary = computed<SprayChartSummary>(() => {
    const map = this.dataByYear();
    const selected = this.selectedYears();
    const ef = this.effectiveFilters();

    const points = selected.flatMap((y) => map.get(Number(y)) ?? []);

    return computeSprayZones(points, ef);
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      this.loadData(slug);
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

  private loadData(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.dataByYear.set(new Map());
    this.rawRoster.set({});
    this.filters.set({
      playerName: null,
      outcomes: [...ALL_OUTCOMES],
      contactTypes: [...ALL_CONTACT_TYPES],
      contactQualities: [...ALL_CONTACT_QUALITIES],
      outCount: [...ALL_OUT_COUNTS],
      risp: null,
    });

    forkJoin({
      roster: this.dataService.getOpponentRoster(slug).pipe(catchError(() => of({} as JerseyMap))),
      years: forkJoin(
        SPRAY_YEARS.map((year) =>
          this.dataService.getOpponentGameData(slug, year).pipe(catchError(() => of([])))
        )
      ),
    }).subscribe({
      next: ({ roster, years }) => {
        this.rawRoster.set(roster);

        // Parse and normalize first names ("Joe Smith" → "J. Smith")
        const map = new Map<number, SprayDataPoint[]>();
        years.forEach((games, i) => {
          const processed = this.processorService.processGamesWithSnapshots(games);
          const points = processed.games.flatMap((game, gi) =>
            parseSprayData(game.snapshots, gi)
          );
          points.forEach((p) => (p.playerName = normalizePlayerName(p.playerName)));
          map.set(SPRAY_YEARS[i], points);
        });

        // Merge truncated last names ("E. Santi" → "E. Santiago") using jersey numbers
        const allNames = [...new Set(SPRAY_YEARS.flatMap((y) => (map.get(y) ?? []).map((p) => p.playerName)))];
        const canonMap = buildCanonicalNameMap(allNames, roster);

        if (canonMap.size > 0) {
          map.forEach((points) => {
            points.forEach((p) => {
              const canon = canonMap.get(p.playerName);

              if (canon) {
                p.playerName = canon;
              }
            });
          });
        }

        this.dataByYear.set(map);
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
