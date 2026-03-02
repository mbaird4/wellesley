import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type {
  OpponentDisplayRow,
  OpponentPitchingData,
  OpponentTeam,
  PlayerTier,
  SortDir,
  SortKey,
  TeamEntry,
  YearData,
} from '@ws/data-access';
import { BreakpointService } from '@ws/shared/util';
import { calculateWoba } from '@ws/stats-core';

import { OpponentSprayChart } from './opponent-spray-chart/opponent-spray-chart';
import { PitcherAnalysis } from './pitcher-analysis/pitcher-analysis';
import { PlayerCardList } from './player-card-list/player-card-list';
import { PlayerTable } from './player-table/player-table';
import { TeamSelector } from './team-selector/team-selector';

export type OpponentTab = 'woba' | 'spray' | 'pitching';

@Component({
  selector: 'ws-opponents',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TeamSelector,
    PlayerTable,
    PlayerCardList,
    OpponentSprayChart,
    PitcherAnalysis,
  ],
  host: { class: 'block stats-section' },
  templateUrl: './opponents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Opponents {
  private http = inject(HttpClient);
  readonly bp = inject(BreakpointService);

  readonly teams: TeamEntry[] = [
    { slug: 'wpi', name: 'WPI' },
    { slug: 'wheaton', name: 'Wheaton' },
    { slug: 'springfield', name: 'Springfield' },
    { slug: 'smith', name: 'Smith' },
    { slug: 'salve', name: 'Salve Regina' },
    { slug: 'mit', name: 'MIT' },
    { slug: 'emerson', name: 'Emerson' },
    { slug: 'coastguard', name: 'Coast Guard' },
    { slug: 'clark', name: 'Clark' },
    { slug: 'babson', name: 'Babson' },
  ].sort((a, b) => a.name.localeCompare(b.name));

  readonly activeTab = signal<OpponentTab>('woba');
  readonly selectedSlug = signal(this.teams[0].slug);
  readonly teamData = signal<OpponentTeam | null>(null);
  readonly pitchingData = signal<OpponentPitchingData | null>(null);
  readonly loading = signal(false);
  readonly pitchingLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly expandedPlayer = signal<string | null>(null);
  readonly sortKey = signal<SortKey>('career');
  readonly sortDir = signal<SortDir>('desc');
  readonly yearSortYear = signal<number | null>(null);

  readonly selectedTeamName = computed(
    () => this.teams.find((t) => t.slug === this.selectedSlug())?.name ?? ''
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

  /** Build display rows from raw data, then sort — single computed derivation */
  readonly displayRows = computed(() => {
    const data = this.teamData();
    if (!data) {
      return [];
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    const yearSort = this.yearSortYear();

    const gpByYear = data.teamGamesByYear ?? {};

    const rows: OpponentDisplayRow[] = data.players.map((player) => {
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

      // Build yearData map for O(1) template lookups
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

      // Compute tier: ≥2 PA per team game (only counting seasons player was on the team)
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

    // Sort — players with no data always last
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

  readonly empty = computed(
    () =>
      this.regulars().length === 0 &&
      this.reserves().length === 0 &&
      !this.loading() &&
      !this.error()
  );

  constructor() {
    this.loadTeam(this.selectedSlug());
  }

  selectTeam(slug: string): void {
    if (slug === this.selectedSlug()) {
      return;
    }

    this.selectedSlug.set(slug);
    this.pitchingData.set(null);
    this.loadTeam(slug);

    if (this.activeTab() === 'pitching') {
      this.loadPitching(slug);
    }
  }

  selectTab(tab: OpponentTab): void {
    this.activeTab.set(tab);

    if (tab === 'pitching' && !this.pitchingData() && !this.pitchingLoading()) {
      this.loadPitching(this.selectedSlug());
    }
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

  private loadTeam(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.expandedPlayer.set(null);
    this.yearSortYear.set(null);

    this.http
      .get<OpponentTeam>(
        `${document.querySelector('base')?.getAttribute('href') || '/'}data/opponents/${slug}/historical-stats.json`
      )
      .subscribe({
        next: (data) => {
          this.teamData.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load team data');
          this.loading.set(false);
          this.teamData.set(null);
        },
      });
  }

  private loadPitching(slug: string): void {
    this.pitchingLoading.set(true);

    const base =
      document.querySelector('base')?.getAttribute('href') || '/';

    this.http
      .get<OpponentPitchingData>(
        `${base}data/opponents/${slug}/pitching.json`
      )
      .subscribe({
        next: (data) => {
          this.pitchingData.set(data);
          this.pitchingLoading.set(false);
        },
        error: () => {
          this.pitchingData.set(null);
          this.pitchingLoading.set(false);
        },
      });
  }
}
