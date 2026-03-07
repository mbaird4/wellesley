import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BreakpointService } from '@ws/core/util';

import { TeamSelector } from './team-selector/team-selector';
import { OPPONENT_TEAMS } from './teams';

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
}
