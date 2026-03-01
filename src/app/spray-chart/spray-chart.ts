import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SoftballStatsService } from '@ws/data-access';
import {
  ALL_CONTACT_QUALITIES,
  ALL_CONTACT_TYPES,
  ALL_OUT_COUNTS,
  ALL_OUTCOMES,
  computeAllowedContacts,
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
import { computeSprayZones, parseSprayData } from '@ws/stats-core';

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
  host: { class: 'flex flex-col overflow-hidden', style: 'height: calc(100vh - 140px)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayChart {
  private statsService = inject(SoftballStatsService);
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

  // Filtered + aggregated summary
  summary = computed<SprayChartSummary>(() => {
    const f = this.filters();
    const allowed = computeAllowedContacts(f);
    const effectiveContactTypes = f.contactTypes.filter((ct) => allowed.has(ct));

    return computeSprayZones(this.allDataPoints(), {
      playerName: f.playerName,
      outcomes: f.outcomes,
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

    this.statsService.getStats(this.selectedYear).subscribe({
      next: (stats) => {
        const points = stats.games.flatMap((game, i) =>
          parseSprayData(game.snapshots, i)
        );
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
