import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { TeamEntry } from '@ws/core/models';

@Component({
  selector: 'ws-team-selector',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
  ],
  host: { class: 'block' },
  templateUrl: './team-selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamSelector {
  readonly teams = input.required<TeamEntry[]>();
  readonly floridaTeams = input<TeamEntry[]>([]);
  readonly layout = input<'horizontal' | 'vertical'>('vertical');
}
