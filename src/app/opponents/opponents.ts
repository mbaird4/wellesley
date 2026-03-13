import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import type { TeamEntry } from '@ws/core/models';
import { BreakpointService } from '@ws/core/util';
import { filter, map, startWith } from 'rxjs';

import { TeamSelector } from './team-selector/team-selector';
import { FLORIDA_TEAMS, NEXT_OPPONENT_DATA_PATH, type NextOpponentMeta, OPPONENT_TEAMS } from './teams';

@Component({
  selector: 'ws-opponents',
  standalone: true,
  imports: [
    RouterOutlet,
    TeamSelector,
  ],
  host: { class: 'block stats-section' },
  templateUrl: './opponents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Opponents {
  readonly bp = inject(BreakpointService);
  readonly teams = OPPONENT_TEAMS;
  readonly floridaTeams = FLORIDA_TEAMS;
  readonly nextOpponentTeam = signal<TeamEntry | null>(null);
  readonly nextOpponentDate = signal<string | null>(null);

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly activeTab = computed(() => {
    const segments = this.url().split('/');

    return segments[segments.length - 1] || 'vs-wellesley';
  });

  constructor() {
    const base = document.querySelector('base')?.getAttribute('href') || '/';

    this.http.get<NextOpponentMeta>(`${base}data/opponents/${NEXT_OPPONENT_DATA_PATH}/meta.json`).subscribe({
      next: (meta) => {
        this.nextOpponentTeam.set({
          slug: NEXT_OPPONENT_DATA_PATH,
          name: meta.name,
          group: 'next',
          dataPath: NEXT_OPPONENT_DATA_PATH,
        });
        this.nextOpponentDate.set(meta.gameDate);
      },
    });
  }
}
