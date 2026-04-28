import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SoftballDataService } from '@ws/core/data';
import type { TeamEntry } from '@ws/core/models';
import { BreakpointService } from '@ws/core/util';
import { filter, map, startWith } from 'rxjs';

import { TeamSelector } from './team-selector/team-selector';
import { FLORIDA_TEAMS, NEXT_OPPONENT_DATA_PATH, OPPONENT_TEAMS } from './teams';

@Component({
  selector: 'ws-opponents',
  standalone: true,
  imports: [RouterOutlet, TeamSelector],
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

  private readonly dataService = inject(SoftballDataService);
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
    this.dataService.getOpponentMeta(NEXT_OPPONENT_DATA_PATH).subscribe({
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
