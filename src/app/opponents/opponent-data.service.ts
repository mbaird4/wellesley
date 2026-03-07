import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { mergeBattingYears, mergePitchingYears } from '@ws/core/data';
import {
  type DisplayRow,
  type PitchingData,
  type PlayerTier,
  type Roster,
  type SortDir,
  type SortKey,
  type Team,
  type TeamEntry,
  toJerseyMap,
  type YearBattingData,
  type YearData,
  type YearPitchingData,
} from '@ws/core/models';
import { calculateWoba } from '@ws/core/processors';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { OPPONENT_TEAMS } from './teams';

@Injectable()
export class OpponentDataService {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  readonly teams: TeamEntry[] = OPPONENT_TEAMS;

  readonly slug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
    { initialValue: '' }
  );

  readonly teamData = signal<Team | null>(null);
  readonly pitchingData = signal<PitchingData | null>(null);
  readonly loading = signal(false);
  readonly pitchingLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly expandedPlayer = signal<string | null>(null);
  readonly sortKey = signal<SortKey>('career');
  readonly sortDir = signal<SortDir>('desc');
  readonly yearSortYear = signal<number | null>(null);
  readonly rosterNames = signal<Set<string>>(new Set());
  readonly roster = signal<Roster | null>(null);

  readonly selectedTeamName = computed(
    () => this.teams.find((t) => t.slug === this.slug())?.name ?? ''
  );

  readonly allYears = computed(() => {
    const data = this.teamData();

    if (!data) {
      return [];
    }

    const yearSet = new Set(
      data.players.flatMap((player) => player.seasons.map((s) => s.year))
    );

    return Array.from(yearSet).sort((a, b) => a - b);
  });

  readonly displayRows = computed(() => {
    const data = this.teamData();
    if (!data) {
      return [];
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    const yearSort = this.yearSortYear();

    const gpByYear = data.teamGamesByYear ?? {};

    const rows: DisplayRow[] = data.players.map((player) => {
      const sortedSeasons = [...player.seasons].sort((a, b) => a.year - b.year);

      const accum = {
        ab: 0,
        h: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        bb: 0,
        hbp: 0,
        sf: 0,
        sh: 0,
      };
      const cumulativeByYear = sortedSeasons.map((s) => {
        accum.ab += s.ab;
        accum.h += s.h;
        accum.doubles += s.doubles;
        accum.triples += s.triples;
        accum.hr += s.hr;
        accum.bb += s.bb;
        accum.hbp += s.hbp;
        accum.sf += s.sf;
        accum.sh += s.sh;
        const pa = accum.ab + accum.bb + accum.sf + accum.sh + accum.hbp;

        return { year: s.year, woba: calculateWoba({ ...accum }), pa };
      });

      const yearData = new Map<number, YearData>(
        sortedSeasons.map((s, i) => {
          const cum = cumulativeByYear[i];
          const label =
            i === 0
              ? `${s.year}`
              : `${cumulativeByYear[0].year}\u2013${String(s.year).slice(2)}`;

          return [
            s.year,
            {
              season: s,
              cumulative: { woba: cum.woba, pa: cum.pa },
              cumulativeLabel: label,
            },
          ];
        })
      );

      const playerTeamGames = sortedSeasons.reduce(
        (sum, s) => sum + (gpByYear[String(s.year)] ?? 0),
        0
      );
      const paPerGame =
        playerTeamGames > 0 ? player.career.pa / playerTeamGames : 0;
      const tier: PlayerTier = paPerGame >= 2 ? 'regular' : 'reserve';

      return {
        name: player.name,
        jerseyNumber: player.jerseyNumber,
        classYear: player.classYear,
        seasons: sortedSeasons,
        cumulativeByYear,
        yearData,
        career: player.career,
        tier,
        paPerGame,
      };
    });

    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const aEmpty = a.seasons.length === 0 ? 1 : 0;
      const bEmpty = b.seasons.length === 0 ? 1 : 0;
      if (aEmpty !== bEmpty) {
        return aEmpty - bEmpty;
      }

      if (yearSort !== null) {
        const aWoba = a.yearData.get(yearSort)?.season.woba ?? -1;
        const bWoba = b.yearData.get(yearSort)?.season.woba ?? -1;

        return mult * (aWoba - bWoba);
      } else if (key === 'name') {
        return mult * a.name.localeCompare(b.name);
      } else {
        return mult * (a.career.woba - b.career.woba);
      }
    });

    return rows;
  });

  readonly regulars = computed(() =>
    this.displayRows().filter((r) => r.tier === 'regular')
  );

  readonly reserves = computed(() =>
    this.displayRows().filter((r) => r.tier === 'reserve')
  );

  readonly jerseyMap = computed<Record<string, number> | null>(() => {
    const roster = this.roster();

    if (!roster) {
      return null;
    }

    return toJerseyMap(roster);
  });

  readonly empty = computed(
    () =>
      this.regulars().length === 0 &&
      this.reserves().length === 0 &&
      !this.loading() &&
      !this.error()
  );

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (!slug) {
        return;
      }

      this.pitchingData.set(null);
      this.loadTeam(slug);
    });
  }

  togglePlayer(name: string): void {
    this.expandedPlayer.update((current) => (current === name ? null : name));
  }

  sort(key: SortKey): void {
    this.yearSortYear.set(null);
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'career' ? 'desc' : 'asc');
    }
  }

  sortByYear(year: number): void {
    this.yearSortYear.set(year);
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  loadPitching(slug: string): void {
    if (this.pitchingData() || this.pitchingLoading()) {
      return;
    }

    this.pitchingLoading.set(true);

    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

    const requests = years.map((year) => {
      const file =
        year === currentYear ? 'pitching.json' : `pitching-${year}.json`;

      return this.http
        .get<YearPitchingData>(`${base}data/opponents/${slug}/${file}`)
        .pipe(catchError(() => of(null)));
    });

    forkJoin(requests).subscribe({
      next: (results) => {
        const valid = results.filter((r): r is YearPitchingData => r !== null);
        this.pitchingData.set(mergePitchingYears(valid));
        this.pitchingLoading.set(false);
      },
      error: () => {
        this.pitchingData.set(null);
        this.pitchingLoading.set(false);
      },
    });
  }

  private loadTeam(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.expandedPlayer.set(null);
    this.yearSortYear.set(null);

    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

    const requests = years.map((year) => {
      const file =
        year === currentYear
          ? 'batting-stats.json'
          : `batting-stats-${year}.json`;

      return this.http
        .get<YearBattingData>(`${base}data/opponents/${slug}/${file}`)
        .pipe(catchError(() => of(null)));
    });

    const rosterRequest = this.http
      .get<Roster>(`${base}data/opponents/${slug}/roster.json`)
      .pipe(catchError(() => of(null)));

    forkJoin([forkJoin(requests), rosterRequest]).subscribe({
      next: ([results, roster]) => {
        const valid = results.filter((r): r is YearBattingData => r !== null);
        this.teamData.set(mergeBattingYears(valid, roster));
        this.rosterNames.set(roster ? new Set(Object.keys(roster)) : new Set());
        this.roster.set(roster);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load team data');
        this.loading.set(false);
        this.teamData.set(null);
      },
    });
  }
}
