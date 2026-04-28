import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { TeamEntry } from '@ws/core/models';

@Component({
  selector: 'ws-team-selector',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  host: { class: 'block' },
  templateUrl: './team-selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamSelector {
  readonly teams = input.required<TeamEntry[]>();
  readonly floridaTeams = input<TeamEntry[]>([]);
  readonly nextOpponent = input<TeamEntry | null>(null);
  readonly nextOpponentDate = input<string | null>(null);
  readonly layout = input<'horizontal' | 'vertical'>('vertical');
  readonly activeTab = input<string>('vs-wellesley');

  readonly formattedDate = computed(() => {
    const date = this.nextOpponentDate();

    if (!date) {
      return null;
    }

    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);

    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  });
}
