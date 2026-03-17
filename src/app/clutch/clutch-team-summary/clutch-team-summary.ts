import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ClutchMetric, TeamSummary } from '@ws/core/models';

@Component({
  selector: 'ws-clutch-team-summary',
  standalone: true,
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clutch-team-summary.html',
})
export class ClutchTeamSummary {
  readonly summary = input.required<TeamSummary>();
  readonly metric = input.required<ClutchMetric>();
  readonly filterContext = input.required<string>();

  readonly contextCapitalized = computed(() => {
    const ctx = this.filterContext();

    return ctx.charAt(0).toUpperCase() + ctx.slice(1);
  });
}
