import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { BaseRunners, ClutchEvent } from '@ws/core/models';
import { Diamond, FormatPlayTypePipe, FormatRunnerOutcomePipe, FormatSituationPipe, RunnerOutcomeClassPipe } from '@ws/core/ui';

@Component({
  selector: 'ws-clutch-event-row',
  standalone: true,
  imports: [
    Diamond,
    FormatPlayTypePipe,
    FormatRunnerOutcomePipe,
    FormatSituationPipe,
    RunnerOutcomeClassPipe,
  ],
  host: { class: 'flex flex-col gap-2 py-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clutch-event-row.html',
})
export class ClutchEventRow {
  readonly event = input.required<ClutchEvent>();

  readonly basesBefore = computed<BaseRunners>(() => {
    const e = this.event();
    const bases: BaseRunners = { first: null, second: null, third: null };
    e.runnersOn.forEach((r) => {
      bases[r.baseBefore] = r.name;
    });

    return bases;
  });

  readonly outDots = computed(() => [0, 1, 2].map((i) => i < this.event().outsBefore));
}
