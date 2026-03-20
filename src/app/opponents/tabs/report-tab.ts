import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { SoftballDataService, SoftballProcessorService } from '@ws/core/data';
import type { GameData, Roster, SprayDataPoint, Team } from '@ws/core/models';
import { buildDisplayJerseyMap, canonicalizeSprayNames, computeSprayZones, normalizePlayerName, normalizePlayerNames, parseSprayData } from '@ws/core/processors';
import { aggregateStats, type PrintPlayerSummary, SPRAY_YEARS, SprayChartPrintView } from '@ws/core/ui';
import { catchError, forkJoin, of } from 'rxjs';

import { OpponentDataService } from '../opponent-data.service';

@Component({
  selector: 'ws-report-tab',
  standalone: true,
  imports: [SprayChartPrintView],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-tab.html',
})
export class ReportTab {
  readonly data = inject(OpponentDataService);
  private dataService = inject(SoftballDataService);
  private processorService = inject(SoftballProcessorService);

  readonly dataByYear = signal<Map<number, SprayDataPoint[]>>(new Map());
  readonly roster = signal<Roster>({});
  readonly sprayLoaded = signal(false);
  readonly pitchingLoaded = signal(false);

  readonly ready = computed(() => this.sprayLoaded() && this.pitchingLoaded());

  readonly players = computed(() => {
    const map = this.dataByYear();

    return Array.from(new Set(SPRAY_YEARS.flatMap((y) => (map.get(y) ?? []).map((p) => p.playerName)))).sort();
  });

  readonly jerseyMap = computed(() => {
    const sprayMap = buildDisplayJerseyMap(this.roster(), this.players());
    const team = this.data.teamData();

    if (!team) {
      return sprayMap;
    }

    const map: Record<string, number> = { ...sprayMap };
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

  private readonly sprayJerseys = computed(() => {
    const sprayMap = buildDisplayJerseyMap(this.roster(), this.players());

    return new Set(Object.values(sprayMap));
  });

  readonly rosteredPlayers = computed(() => {
    const team = this.data.teamData();
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
      const latestPa = this.latestSeasonPa(team, p.jerseyNumber);
      const bucket = p.jerseyNumber !== null && hasData.has(p.jerseyNumber) ? withData : withoutData;
      bucket.push({ name: displayName, jersey: p.jerseyNumber, pa: latestPa });
    });

    const sortFn = (a: (typeof withData)[0], b: (typeof withData)[0]) => b.pa - a.pa || (a.jersey ?? 0) - (b.jersey ?? 0);
    withData.sort(sortFn);
    withoutData.sort(sortFn);

    return [...withData.map((p) => p.name), ...withoutData.map((p) => p.name)];
  });

  readonly selectedYearLabels = computed(() => SPRAY_YEARS.filter((y) => (this.dataByYear().get(y)?.length ?? 0) > 0).map(String));

  readonly allPlayerSummaries = computed<PrintPlayerSummary[]>(() => {
    const years = SPRAY_YEARS;
    const allData = years.flatMap((y) => this.dataByYear().get(y) ?? []);
    const team = this.data.teamData();
    const jerseyMap = this.jerseyMap();

    return this.rosteredPlayers()
      .map((name) => {
        const jersey = jerseyMap[name];
        const rp = team?.players.find((p) => p.jerseyNumber === jersey);
        const stats = rp ? aggregateStats(rp, years) : null;

        return {
          name,
          jersey,
          summary: computeSprayZones(allData, { playerName: name }),
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
    // Load spray data when slug is available
    effect(() => {
      const slug = this.data.slug();

      if (slug) {
        this.loadSprayData(slug);
      }
    });

    // Load pitching data when slug is available
    effect(() => {
      const slug = this.data.slug();

      if (slug) {
        this.data.loadPitching(this.data.dataDir());
        this.pitchingLoaded.set(true);
      }
    });
  }

  private loadSprayData(slug: string): void {
    const dir = this.data.dataDir() || slug;

    forkJoin({
      roster: this.dataService.getOpponentRoster(dir).pipe(catchError(() => of({} as Roster))),
      years: forkJoin(SPRAY_YEARS.map((year) => this.dataService.getOpponentGameData(dir, year).pipe(catchError(() => of([] as GameData[]))))),
    }).subscribe({
      next: ({ roster, years }) => {
        this.roster.set(roster);

        const map = new Map<number, SprayDataPoint[]>();
        years.forEach((games, i) => {
          const processed = this.processorService.processGamesWithSnapshots(games);
          const points = processed.games.flatMap((game, gi) => parseSprayData(game.snapshots, gi));
          map.set(SPRAY_YEARS[i], points);
        });

        canonicalizeSprayNames(map, SPRAY_YEARS, roster);
        this.dataByYear.set(map);
        this.sprayLoaded.set(true);
      },
      error: () => {
        this.sprayLoaded.set(true);
      },
    });
  }

  private latestSeasonPa(team: Team, jersey: number): number {
    const rp = team.players.find((p) => p.jerseyNumber === jersey);

    if (!rp?.seasons.length) {
      return 0;
    }

    return rp.seasons.reduce((best, s) => (s.year > best.year ? s : best)).pa;
  }
}
