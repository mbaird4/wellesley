import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { mergeBattingYears, mergePitchingYears, RosterService, SoftballDataService } from '@ws/core/data';
import { type DisplayRow, type PitchingData, type PlayerTier, type Roster, type SortDir, type SortKey, type Team, type TeamEntry, toJerseyMap, type VsWellesleyData, type YearBattingData, type YearData, type YearPitchingData } from '@ws/core/models';
import { calculateWoba, computeVsWellesleyStats } from '@ws/core/processors';
import { RECENT_YEARS } from '@ws/core/util';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ALL_OPPONENT_TEAMS, NEXT_OPPONENT_DATA_PATH, SLUG_TO_OPPONENT_NAMES } from './teams';

@Injectable()
export class OpponentDataService {
  private route = inject(ActivatedRoute);
  private softballData = inject(SoftballDataService);
  private rosterService = inject(RosterService);

  readonly teams: TeamEntry[] = ALL_OPPONENT_TEAMS;

  readonly slug = toSignal(this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')), { initialValue: '' });

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
  readonly vsWellesleyData = signal<VsWellesleyData | null>(null);
  readonly vsWellesleyLoading = signal(false);
  readonly wellesleyRosterNames = this.rosterService.wellesleyRosterNames;
  readonly wellesleyPitcherOrder = signal<string[]>([]);

  readonly nextOpponentName = signal<string>('');

  readonly selectedTeamName = computed(() => {
    const slug = this.slug();

    if (slug === NEXT_OPPONENT_DATA_PATH) {
      return this.nextOpponentName() || 'Next Opponent';
    }

    return this.teams.find((t) => t.slug === slug)?.name ?? '';
  });

  readonly dataDir = computed(() => {
    const slug = this.slug();

    if (slug === NEXT_OPPONENT_DATA_PATH) {
      return NEXT_OPPONENT_DATA_PATH;
    }

    const team = this.teams.find((t) => t.slug === slug);

    return team?.dataPath ?? slug;
  });

  readonly allYears = computed(() => {
    const data = this.teamData();

    if (!data) {
      return [];
    }

    const yearSet = new Set(data.players.flatMap((player) => player.seasons.map((s) => s.year)));

    return Array.from(yearSet).sort((a, b) => b - a);
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
          const label = i === 0 ? `${s.year}` : `${cumulativeByYear[0].year}\u2013${String(s.year).slice(2)}`;

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

      // Use the most recent season's PA rate for tier classification
      // so early-season players aren't penalized by accumulated historical games
      const latestSeason = sortedSeasons[sortedSeasons.length - 1] as (typeof sortedSeasons)[number] | undefined;
      const latestTeamGames = latestSeason ? (gpByYear[String(latestSeason.year)] ?? 0) : 0;
      const paPerGame = latestTeamGames > 0 ? latestSeason!.pa / latestTeamGames : 0;
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

  readonly regulars = computed(() => this.displayRows().filter((r) => r.tier === 'regular'));

  readonly reserves = computed(() => this.displayRows().filter((r) => r.tier === 'reserve'));

  readonly jerseyMap = computed<Record<string, number> | null>(() => {
    const roster = this.roster();

    if (!roster) {
      return null;
    }

    return toJerseyMap(roster);
  });

  readonly empty = computed(() => this.displayRows().length === 0 && !this.loading() && !this.error());

  constructor() {
    effect(() => {
      const slug = this.slug();

      if (!slug) {
        return;
      }

      this.pitchingData.set(null);
      this.vsWellesleyData.set(null);

      if (slug === NEXT_OPPONENT_DATA_PATH) {
        this.loadNextOpponentMeta();
      }

      this.loadTeam(this.dataDir());
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

  loadPitching(dataDir: string): void {
    if (this.pitchingData() || this.pitchingLoading()) {
      return;
    }

    this.pitchingLoading.set(true);

    const requests = RECENT_YEARS.map((year) => this.softballData.getOpponentPitchingData(dataDir, year).pipe(catchError(() => of(null))));

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

  readonly nextOpponentSlug = signal<string>('');

  loadVsWellesley(slug: string): void {
    if (this.vsWellesleyData() || this.vsWellesleyLoading()) {
      return;
    }

    // For next-opponent, use the actual team slug from meta
    const lookupSlug = slug === NEXT_OPPONENT_DATA_PATH ? this.nextOpponentSlug() : slug;
    const opponentNames = SLUG_TO_OPPONENT_NAMES[lookupSlug];

    if (!opponentNames) {
      return;
    }

    this.vsWellesleyLoading.set(true);

    const requests = RECENT_YEARS.map((year) => this.softballData.getWellesleyPitchingData(year).pipe(catchError(() => of(null))));

    forkJoin(requests).subscribe({
      next: (results) => {
        const valid = results.filter((r): r is YearPitchingData => r !== null);
        const merged = mergePitchingYears(valid);
        this.vsWellesleyData.set(computeVsWellesleyStats(merged.games, opponentNames));

        // Compute career BF per pitcher from stats page totals
        if (this.wellesleyPitcherOrder().length === 0) {
          const bfByPitcher = new Map<string, number>();
          Object.values(merged.pitchingStatsByYear).forEach((stats) => {
            stats.forEach((s) => {
              const bf = s.ab + s.bb + s.hbp + s.sfa + s.sha;
              bfByPitcher.set(s.name, (bfByPitcher.get(s.name) ?? 0) + bf);
            });
          });
          this.wellesleyPitcherOrder.set(
            Array.from(bfByPitcher.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([name]) => name)
          );
        }

        this.vsWellesleyLoading.set(false);
      },
      error: () => {
        this.vsWellesleyData.set(null);
        this.vsWellesleyLoading.set(false);
      },
    });
  }

  private loadNextOpponentMeta(): void {
    this.softballData.getOpponentMeta(NEXT_OPPONENT_DATA_PATH).subscribe({
      next: (meta) => {
        this.nextOpponentName.set(meta.name);
        this.nextOpponentSlug.set(meta.slug);
      },
    });
  }

  private loadTeam(dataDir: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.expandedPlayer.set(null);
    this.yearSortYear.set(null);

    const requests = RECENT_YEARS.map((year) => this.softballData.getOpponentBattingData(dataDir, year).pipe(catchError(() => of(null))));

    const rosterRequest = this.softballData.getOpponentRoster(dataDir).pipe(catchError(() => of(null)));

    forkJoin([forkJoin(requests), rosterRequest]).subscribe({
      next: ([results, roster]) => {
        const valid = results.filter((r): r is YearBattingData => r !== null);
        const team = mergeBattingYears(valid, roster);
        this.teamData.set(team);
        this.rosterNames.set(roster ? new Set(Object.keys(roster)) : new Set());
        this.roster.set(roster);

        // Default sort by most recent year with data
        const maxYear = team.players.flatMap((p) => p.seasons.map((s) => s.year)).reduce((max, y) => Math.max(max, y), 0);

        if (maxYear > 0) {
          this.yearSortYear.set(maxYear);
          this.sortDir.set('desc');
        }

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
