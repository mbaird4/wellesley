import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  isDevMode,
  signal,
} from '@angular/core';
import type {
  Roster,
  SprayChartSummary,
  SprayDataPoint,
  SprayZone,
  Team,
} from '@ws/core/models';
import { buildDisplayJerseyMap, computeSprayZones } from '@ws/core/processors';
import { BreakpointService } from '@ws/core/util';

import {
  ButtonToggle,
  type ToggleOption,
} from '../button-toggle/button-toggle';
import {
  type PrintOptions,
  PrintOptionsModal,
} from '../print-options-modal/print-options-modal';
import { SprayChartCoachPrintView } from '../spray-chart-coach-print-view/spray-chart-coach-print-view';
import { SprayChartPrintView } from '../spray-chart-print-view/spray-chart-print-view';
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
import { SprayPlayerHero } from '../spray-player-hero/spray-player-hero';
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
    PrintOptionsModal,
    SprayChartCoachPrintView,
    SprayChartPrintView,
    SprayField,
    SprayFilters,
    SprayLegend,
    SprayPlayerHero,
    SprayYearPanel,
  ],
  templateUrl: './spray-chart-viewer.html',
  host: {
    class:
      'flex flex-col gap-3 print:block print:overflow-visible stagger-children',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayChartViewer {
  readonly bp = inject(BreakpointService);

  readonly dataByYear = input.required<Map<number, SprayDataPoint[]>>();
  readonly roster = input.required<Roster>();
  readonly teamData = input<Team | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly emptyMessage = input('No spray chart data available.');
  readonly includeUnmatchedRoster = input(false);
  readonly printTitle = input('');

  readonly viewMode = signal<'split' | 'combined'>('combined');
  readonly selectedYears = signal<string[]>([String(CURRENT_YEAR)]);
  readonly viewModeOptions = VIEW_MODE_OPTIONS;
  readonly yearOptions = YEAR_OPTIONS;
  readonly disabledYears = computed(() =>
    SPRAY_YEARS.filter(
      (y) => (this.dataByYear().get(y)?.length ?? 0) === 0
    ).map(String)
  );

  readonly filters = signal<SprayFilterState>({
    playerName: null,
    outcomes: [...ALL_OUTCOMES],
    contactTypes: [...ALL_CONTACT_TYPES],
    contactQualities: [...ALL_CONTACT_QUALITIES],
    outCount: [...ALL_OUT_COUNTS],
    risp: null,
  });

  readonly highlightZone = signal<SprayZone | null>(null);
  readonly showPrintModal = signal(false);
  readonly printDugout = signal(true);
  readonly printCoach = signal(true);
  readonly printPreview = signal(false);
  readonly isDev = isDevMode();

  readonly hasNonDefaultFilters = computed(() => {
    const f = this.filters();

    return (
      f.outcomes.length !== ALL_OUTCOMES.length ||
      f.contactTypes.length !== ALL_CONTACT_TYPES.length ||
      f.contactQualities.length !== ALL_CONTACT_QUALITIES.length ||
      f.outCount.length !== ALL_OUT_COUNTS.length ||
      f.risp !== null
    );
  });

  readonly printSubtitle = computed(() => {
    if (!this.hasNonDefaultFilters()) {
      return '';
    }

    const f = this.filters();
    const parts: string[] = [];

    if (f.outcomes.length !== ALL_OUTCOMES.length) {
      parts.push(
        f.outcomes
          .map((o) => `${o.charAt(0).toUpperCase() + o.slice(1)}s`)
          .join(', ')
      );
    }

    if (f.contactTypes.length !== ALL_CONTACT_TYPES.length) {
      const labels: Record<string, string> = {
        hit: 'Line drives',
        line_out: 'Line outs',
        ground_ball: 'Ground balls',
        popup: 'Popups',
        bunt: 'Bunts',
      };
      parts.push(f.contactTypes.map((t) => labels[t] ?? t).join(', '));
    }

    if (f.contactQualities.length !== ALL_CONTACT_QUALITIES.length) {
      parts.push(
        f.contactQualities
          .map((q) => q.charAt(0).toUpperCase() + q.slice(1))
          .join(', ')
      );
    }

    if (f.outCount.length !== ALL_OUT_COUNTS.length) {
      parts.push(f.outCount.map((o) => `${o} outs`).join(', '));
    }

    if (f.risp !== null) {
      parts.push(f.risp ? 'RISP' : 'No RISP');
    }

    return parts.join(' · ');
  });

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

  readonly allPlayerSummaries = computed(() => {
    const allData = this.selectedYears().flatMap(
      (y) => this.dataByYear().get(Number(y)) ?? []
    );
    const ef = this.effectiveFilters();
    const team = this.teamData();

    const jerseyMap = this.jerseyMap();

    return this.rosteredPlayers()
      .map((name) => {
        const jersey = jerseyMap[name];
        const rp = team?.players.find((p) => p.jerseyNumber === jersey);

        return {
          name,
          jersey,
          summary: computeSprayZones(allData, { ...ef, playerName: name }),
          bats: rp?.bats,
          position: rp?.position,
          avg: rp?.career.avg,
          woba: rp?.career.woba,
          pa: rp?.career.pa,
          sb: rp?.career.sb,
          gp: rp?.career.gp,
          sh: rp?.career.sh,
        };
      })
      .filter((p) => p.summary.totalContact > 0);
  });

  constructor() {
    // Auto-select the most recent year with data (falls back to current year)
    effect(() => {
      const map = this.dataByYear();
      const firstWithData = SPRAY_YEARS.find(
        (y) => (map.get(y)?.length ?? 0) > 0
      );

      this.selectedYears.set([String(firstWithData ?? CURRENT_YEAR)]);

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

  onPrint(): void {
    if (this.teamData()) {
      this.showPrintModal.set(true);

      return;
    }

    this.executePrint();
  }

  onPrintConfirm(opts: PrintOptions): void {
    this.printDugout.set(opts.dugout);
    this.printCoach.set(opts.coach);
    this.showPrintModal.set(false);
    setTimeout(() => this.executePrint(), 0);
  }

  onPrintCancel(): void {
    this.showPrintModal.set(false);
  }

  private executePrint(): void {
    if (!this.hasNonDefaultFilters()) {
      window.print();

      return;
    }

    const msg = `Filters are applied: ${this.printSubtitle()}\n\nOK = print with filters\nCancel = reset to all contact and print`;

    if (confirm(msg)) {
      window.print();
    } else {
      this.filters.set({
        playerName: this.filters().playerName,
        outcomes: [...ALL_OUTCOMES],
        contactTypes: [...ALL_CONTACT_TYPES],
        contactQualities: [...ALL_CONTACT_QUALITIES],
        outCount: [...ALL_OUT_COUNTS],
        risp: null,
      });

      // Allow a tick for the filter reset to propagate before printing
      setTimeout(() => window.print(), 0);
    }
  }
}
