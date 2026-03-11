import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { BreakpointService } from '@ws/core/util';
import { filter, map, startWith } from 'rxjs';

import { TeamSelector } from './team-selector/team-selector';
import { FLORIDA_TEAMS, OPPONENT_TEAMS } from './teams';

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
}
