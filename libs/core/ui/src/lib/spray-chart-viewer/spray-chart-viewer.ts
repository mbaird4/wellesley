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
import type {
  Roster,
  SprayChartSummary,
  SprayDataPoint,
  SprayZone,
} from '@ws/core/models';
import { buildDisplayJerseyMap, computeSprayZones } from '@ws/core/processors';
import { BreakpointService } from '@ws/core/util';

import {
  ButtonToggle,
  type ToggleOption,
} from '../button-toggle/button-toggle';
import { SprayField } from '../spray-field/spray-field';
import {
  ALL_CONTACT_QUALITIES,
  ALL_CONTACT_TYPES,
  ALL_OUT_COUNTS,
  ALL_OUTCOMES,
  computeEffectiveFilters,
  SprayFilters,
  type SprayFilterState,
} from '../spray-filters/spray-filters';
import { SprayLegend } from '../spray-legend/spray-legend';
import { SprayYearPanel } from '../spray-year-panel/spray-year-panel';

export const CURRENT_YEAR = new Date().getFullYear();
export const SPRAY_YEARS = Array.from(
  { length: 4 },
  (_, i) => CURRENT_YEAR - i
);

const VIEW_MODE_OPTIONS: ToggleOption[] = [
  { value: 'combined', label: 'Combined' },
  { value: 'split', label: 'Split' },
];

const YEAR_OPTIONS: ToggleOption[] = SPRAY_YEARS.map((y) => ({
  value: String(y),
  label: String(y),
}));

@Component({
  selector: 'ws-spray-chart-viewer',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ButtonToggle,
    SprayField,
    SprayFilters,
    SprayLegend,
    SprayYearPanel,
  ],
  templateUrl: './spray-chart-viewer.html',
  host: { class: 'flex flex-1 flex-col gap-3 overflow-hidden' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayChartViewer {
  readonly bp = inject(BreakpointService);

  readonly dataByYear = input.required<Map<number, SprayDataPoint[]>>();
  readonly roster = input.required<Roster>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly emptyMessage = input('No spray chart data available.');
  readonly includeUnmatchedRoster = input(false);

  readonly viewMode = signal<'split' | 'combined'>('combined');
  readonly selectedYears = signal<string[]>([String(CURRENT_YEAR)]);
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
    buildDisplayJerseyMap(this.roster(), this.players(), {
      includeUnmatched: this.includeUnmatchedRoster(),
    })
  );

  readonly rosteredPlayers = computed(() => {
    const map = this.jerseyMap();

    if (this.includeUnmatchedRoster()) {
      return Object.keys(map).sort((a, b) => map[a] - map[b]);
    }

    return this.players()
      .filter((p) => map[p] !== undefined)
      .sort((a, b) => map[a] - map[b]);
  });

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
    // Auto-select current year + first year with data when dataByYear changes
    effect(() => {
      const map = this.dataByYear();
      const currentHasData = (map.get(CURRENT_YEAR)?.length ?? 0) > 0;
      const firstWithData = SPRAY_YEARS.find(
        (y) => (map.get(y)?.length ?? 0) > 0
      );
      const years = new Set([String(CURRENT_YEAR)]);

      if (!currentHasData && firstWithData) {
        years.add(String(firstWithData));
      }

      this.selectedYears.set([...years]);

      // Reset filters when data changes
      this.filters.set({
        playerName: null,
        outcomes: [...ALL_OUTCOMES],
        contactTypes: [...ALL_CONTACT_TYPES],
        contactQualities: [...ALL_CONTACT_QUALITIES],
        outCount: [...ALL_OUT_COUNTS],
        risp: null,
      });
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
}
