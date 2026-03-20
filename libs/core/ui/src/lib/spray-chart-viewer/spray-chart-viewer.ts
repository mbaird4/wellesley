import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import type { JerseyMap, Roster, RosterPlayer, SprayDataPoint, SprayTrend, SprayZone, Team } from '@ws/core/models';
import { buildDisplayJerseyMap, calculateWoba, computeSprayZones, detectSprayTrends, normalizePlayerName, normalizePlayerNames } from '@ws/core/processors';
import { BreakpointService, CURRENT_YEAR, RECENT_YEARS } from '@ws/core/util';

import { ErrorBanner } from '../async-states/error-banner';
import { LoadingState } from '../async-states/loading-state';
import { ButtonToggle, type ToggleOption } from '../button-toggle/button-toggle';
import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { ALL_CONTACT_QUALITIES, ALL_CONTACT_TYPES, ALL_OUT_COUNTS, ALL_OUTCOMES, computeEffectiveFilters, SprayFilters, type SprayFilterState } from '../spray-filters/spray-filters';
import { SprayPrintOrchestrator, type ViewMode } from '../spray-print-orchestrator/spray-print-orchestrator';
import { SprayViewCombined } from '../spray-view-combined/spray-view-combined';
import { SprayViewContact } from '../spray-view-contact/spray-view-contact';
import { SprayViewScouting } from '../spray-view-scouting/spray-view-scouting';
import { SprayViewSplit } from '../spray-view-split/spray-view-split';

export { CURRENT_YEAR };
export const SPRAY_YEARS = RECENT_YEARS;

const VIEW_MODE_OPTIONS: ToggleOption[] = [
  { value: 'combined', label: 'Combined' },
  { value: 'split', label: 'Split' },
  { value: 'contact', label: 'Contact' },
  { value: 'scouting', label: 'Scouting' },
];

const YEAR_OPTIONS: ToggleOption[] = SPRAY_YEARS.map((y) => ({
  value: String(y),
  label: String(y),
}));

function latestSeasonPa(team: Team | null, jersey: number): number {
  const rp = team?.players.find((p) => p.jerseyNumber === jersey);

  if (!rp?.seasons.length) {
    return 0;
  }

  return rp.seasons.reduce((best, s) => (s.year > best.year ? s : best)).pa;
}

export function aggregateStats(
  rp: RosterPlayer,
  years: number[]
): {
  avg: number;
  woba: number;
  pa: number;
  sb: number;
  sbAtt: number;
  gp: number;
  sh: number;
  slg: number;
  so: number;
  rbi: number;
  h: number;
  bb: number;
  ab: number;
  doubles: number;
  triples: number;
  hr: number;
} {
  const seasons = rp.seasons.filter((s) => years.includes(s.year));

  if (seasons.length === 0) {
    return {
      avg: 0,
      woba: 0,
      pa: 0,
      sb: 0,
      gp: 0,
      sh: 0,
      slg: 0,
      so: 0,
      rbi: 0,
      h: 0,
      bb: 0,
      ab: 0,
      doubles: 0,
      triples: 0,
      hr: 0,
      sbAtt: 0,
    };
  }

  const t = seasons.reduce(
    (a, s) => ({
      ab: a.ab + s.ab,
      h: a.h + s.h,
      doubles: a.doubles + s.doubles,
      triples: a.triples + s.triples,
      hr: a.hr + s.hr,
      bb: a.bb + s.bb,
      hbp: a.hbp + s.hbp,
      sf: a.sf + s.sf,
      sh: a.sh + s.sh,
      sb: a.sb + s.sb,
      sbAtt: a.sbAtt + s.sbAtt,
      gp: a.gp + s.gp,
      so: a.so + s.so,
      rbi: a.rbi + s.rbi,
    }),
    {
      ab: 0,
      h: 0,
      doubles: 0,
      triples: 0,
      hr: 0,
      bb: 0,
      hbp: 0,
      sf: 0,
      sh: 0,
      sb: 0,
      sbAtt: 0,
      gp: 0,
      so: 0,
      rbi: 0,
    }
  );

  const tb = t.h + t.doubles + 2 * t.triples + 3 * t.hr;

  return {
    avg: t.ab > 0 ? t.h / t.ab : 0,
    woba: calculateWoba(t),
    pa: t.ab + t.bb + t.hbp + t.sf + t.sh,
    sb: t.sb,
    sbAtt: t.sbAtt,
    gp: t.gp,
    sh: t.sh,
    slg: t.ab > 0 ? tb / t.ab : 0,
    so: t.so,
    rbi: t.rbi,
    h: t.h,
    bb: t.bb,
    ab: t.ab,
    doubles: t.doubles,
    triples: t.triples,
    hr: t.hr,
  };
}

@Component({
  selector: 'ws-spray-chart-viewer',
  standalone: true,
  imports: [
    ButtonToggle,
    ErrorBanner,
    LoadingState,
    SprayFilters,
    SprayPrintOrchestrator,
    SprayViewCombined,
    SprayViewContact,
    SprayViewScouting,
    SprayViewSplit,
  ],
  templateUrl: './spray-chart-viewer.html',
  host: {
    class: 'flex flex-col gap-3 print:block print:overflow-visible stagger-children',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayChartViewer {
  readonly bp = inject(BreakpointService);

  readonly dataByYear = input.required<Map<number, SprayDataPoint[]>>();
  readonly roster = input.required<Roster>();
  readonly teamData = input<Team | null>(null);
  readonly lineupOrder = input<Record<string, number>>({});
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly emptyMessage = input('No spray chart data available.');
  readonly printTitle = input('');

  readonly viewMode = signal<ViewMode>('combined');
  readonly selectedYears = signal<string[]>(SPRAY_YEARS.map(String));
  readonly viewModeOptions = VIEW_MODE_OPTIONS;
  readonly yearOptions = YEAR_OPTIONS;
  readonly disabledYears = computed(() => SPRAY_YEARS.filter((y) => (this.dataByYear().get(y)?.length ?? 0) === 0).map(String));

  readonly filters = signal<SprayFilterState>({
    playerName: null,
    outcomes: [...ALL_OUTCOMES],
    contactTypes: [...ALL_CONTACT_TYPES],
    contactQualities: [...ALL_CONTACT_QUALITIES],
    outCount: [...ALL_OUT_COUNTS],
    risp: null,
  });

  readonly highlightZone = signal<SprayZone | null>(null);
  readonly printOrch = viewChild<SprayPrintOrchestrator>('printOrch');

  readonly filterHiddenGroups = computed(() => (this.viewMode() === 'contact' ? new Set(['outcome', 'contact', 'quality']) : new Set<string>()));

  readonly hasNonDefaultFilters = computed(() => {
    const f = this.filters();

    return f.outcomes.length !== ALL_OUTCOMES.length || f.contactTypes.length !== ALL_CONTACT_TYPES.length || f.contactQualities.length !== ALL_CONTACT_QUALITIES.length || f.outCount.length !== ALL_OUT_COUNTS.length || f.risp !== null;
  });

  readonly printSubtitle = computed(() => {
    if (!this.hasNonDefaultFilters()) {
      return '';
    }

    const f = this.filters();
    const parts: string[] = [];

    if (f.outcomes.length !== ALL_OUTCOMES.length) {
      parts.push(f.outcomes.map((o) => `${o.charAt(0).toUpperCase() + o.slice(1)}s`).join(', '));
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
      parts.push(f.contactQualities.map((q) => q.charAt(0).toUpperCase() + q.slice(1)).join(', '));
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

    return Array.from(new Set(SPRAY_YEARS.flatMap((y) => (map.get(y) ?? []).map((p) => p.playerName)))).sort();
  });

  readonly jerseyMap = computed(() => {
    const sprayMap = buildDisplayJerseyMap(this.roster(), this.players());
    const team = this.teamData();

    if (!team) {
      return sprayMap;
    }

    // Add all teamData players so the jersey map is complete.
    // Use collision-aware names to avoid overwriting when two players
    // share the same initial + last name (e.g. "Maddy Bowen" / "Michaella Bowen").
    const map: JerseyMap = { ...sprayMap };
    const existingJerseys = new Set(Object.values(map));
    const uniqueNames = normalizePlayerNames(team.players.map((p) => p.name));

    team.players.forEach((p) => {
      if (p.jerseyNumber !== null && !existingJerseys.has(p.jerseyNumber)) {
        const displayName = uniqueNames.get(p.name) ?? normalizePlayerName(p.name);
        map[displayName] = p.jerseyNumber;
      }
    });

    return map;
  });

  /** Jersey numbers that appear in actual spray data. */
  private readonly sprayJerseys = computed(() => {
    const sprayMap = buildDisplayJerseyMap(this.roster(), this.players());

    return new Set(Object.values(sprayMap));
  });

  /** Players from teamData who have no spray data points. */
  readonly disabledPlayers = computed(() => {
    const team = this.teamData();

    if (!team) {
      return new Set<string>();
    }

    const hasData = this.sprayJerseys();
    const uniqueNames = normalizePlayerNames(team.players.map((p) => p.name));

    return new Set(team.players.filter((p) => p.jerseyNumber === null || !hasData.has(p.jerseyNumber)).map((p) => uniqueNames.get(p.name) ?? normalizePlayerName(p.name)));
  });

  readonly rosteredPlayers = computed(() => {
    const team = this.teamData();
    const map = this.jerseyMap();

    if (!team) {
      return this.players().filter((p) => map[p] !== undefined);
    }

    const hasData = this.sprayJerseys();
    const uniqueNames = normalizePlayerNames(team.players.map((p) => p.name));

    const withData: { name: string; jersey: number | null; pa: number }[] = [];
    const withoutData: { name: string; jersey: number | null; pa: number }[] = [];

    team.players.forEach((p) => {
      const displayName = uniqueNames.get(p.name) ?? normalizePlayerName(p.name);
      const pa = latestSeasonPa(team, p.jerseyNumber);
      const bucket = p.jerseyNumber !== null && hasData.has(p.jerseyNumber) ? withData : withoutData;
      bucket.push({ name: displayName, jersey: p.jerseyNumber, pa });
    });

    const sortFn = (a: (typeof withData)[0], b: (typeof withData)[0]) => b.pa - a.pa || (a.jersey ?? 0) - (b.jersey ?? 0);
    withData.sort(sortFn);
    withoutData.sort(sortFn);

    return [...withData.map((p) => p.name), ...withoutData.map((p) => p.name)];
  });

  readonly effectiveFilters = computed(() => computeEffectiveFilters(this.filters()));

  readonly summaryByYear = computed(() => {
    const map = this.dataByYear();
    const ef = this.effectiveFilters();

    return new Map(SPRAY_YEARS.map((y) => [y, computeSprayZones(map.get(y) ?? [], ef)] as const));
  });

  readonly activeYears = computed(() => SPRAY_YEARS.filter((y) => (this.summaryByYear().get(y)?.totalContact ?? 0) > 0));

  readonly combinedSummary = computed(() =>
    computeSprayZones(
      this.selectedYears().flatMap((y) => this.dataByYear().get(Number(y)) ?? []),
      this.effectiveFilters()
    )
  );

  readonly contactPanels = computed(() => {
    const data = this.selectedYears().flatMap((y) => this.dataByYear().get(Number(y)) ?? []);
    const f = this.filters();
    const base = { playerName: f.playerName, outCount: f.outCount, risp: f.risp ?? undefined };

    return [
      { label: 'Hard Contact', summary: computeSprayZones(data, { ...base, contactQualities: ['hard'] }) },
      { label: 'Weak Contact', summary: computeSprayZones(data, { ...base, contactQualities: ['weak'] }) },
      { label: 'All Contact', summary: computeSprayZones(data, base) },
    ];
  });

  readonly playerTrends = computed<SprayTrend[]>(() => {
    const name = this.filters().playerName;

    if (!name) {
      return [];
    }

    const thisYearData = (this.dataByYear().get(CURRENT_YEAR) ?? []).filter((d) => d.playerName === name);
    const lastYearData = (this.dataByYear().get(CURRENT_YEAR - 1) ?? []).filter((d) => d.playerName === name);

    return detectSprayTrends(thisYearData, lastYearData);
  });

  readonly allPlayerSummaries = computed(() => {
    const years = this.selectedYears().map(Number);
    const allData = years.flatMap((y) => this.dataByYear().get(y) ?? []);
    const ef = this.effectiveFilters();
    const team = this.teamData();
    const jerseyMap = this.jerseyMap();

    return this.rosteredPlayers()
      .map((name) => {
        const jersey = jerseyMap[name];
        const rp = team?.players.find((p) => p.jerseyNumber === jersey);
        const stats = rp ? aggregateStats(rp, years) : null;

        return {
          name,
          jersey,
          summary: computeSprayZones(allData, { ...ef, playerName: name }),
          bats: rp?.bats,
          position: rp?.position,
          avg: stats?.avg,
          woba: stats?.woba,
          pa: stats?.pa,
          sb: stats?.sb,
          sbAtt: stats?.sbAtt,
          gp: stats?.gp,
          sh: stats?.sh,
          slg: stats?.slg,
          so: stats?.so,
          rbi: stats?.rbi,
          h: stats?.h,
          bb: stats?.bb,
          ab: stats?.ab,
          doubles: stats?.doubles,
          triples: stats?.triples,
          hr: stats?.hr,
        };
      })
      .filter((p) => p.summary.totalContact > 0);
  });

  constructor() {
    effect(() => {
      const map = this.dataByYear();
      const yearsWithData = SPRAY_YEARS.filter((y) => (map.get(y)?.length ?? 0) > 0);

      this.selectedYears.set(yearsWithData.length > 0 ? yearsWithData.map(String) : [String(CURRENT_YEAR)]);

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
    const mode = value as ViewMode;
    this.viewMode.set(mode);

    this.filters.update((f) => ({
      ...f,
      outcomes: [...ALL_OUTCOMES],
      contactTypes: [...ALL_CONTACT_TYPES],
      contactQualities: [...ALL_CONTACT_QUALITIES],
    }));
  }

  onYearChange(values: string[] | string): void {
    this.selectedYears.set(values as string[]);
  }

  onZoneHover(zone: SprayZone | null): void {
    this.highlightZone.set(zone);
  }

  onFiltersReset(): void {
    this.filters.set({
      playerName: this.filters().playerName,
      outcomes: [...ALL_OUTCOMES],
      contactTypes: [...ALL_CONTACT_TYPES],
      contactQualities: [...ALL_CONTACT_QUALITIES],
      outCount: [...ALL_OUT_COUNTS],
      risp: null,
    });
  }
}
