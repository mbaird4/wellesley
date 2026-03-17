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
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-content-dim text-xs tabular-nums">{{ event().inning }}</span>
      <span class="flex gap-1">
        @for (dot of outDots(); track $index) {
          <span class="inline-block h-2 w-2 rounded-full" [class]="dot ? 'bg-amber-400' : 'bg-surface-card'"></span>
        }
      </span>
      <span class="text-content-secondary text-sm">{{ event().baseSituation | formatSituation }}</span>
      <span class="text-sm font-medium">{{ event().batterResult | formatPlayType }}</span>
      @if (event().isPinchHit) {
        <span class="bg-brand-bg text-brand-text rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider"> PH </span>
      }
    </div>

    <div class="flex items-start gap-4">
      <ws-diamond [bases]="basesBefore()" [outs]="event().outsBefore" class="w-20 shrink-0" />

      <div class="flex flex-col gap-1">
        @for (runner of event().runnersOn; track runner.name) {
          <div class="flex items-center gap-2 text-sm">
            <span class="text-content-secondary">{{ runner.name }}</span>
            <span class="text-xs font-medium" [class]="runner.outcome | runnerOutcomeClass">
              {{ runner.outcome | formatRunnerOutcome }}
            </span>
          </div>
        }
      </div>
    </div>

    <p class="text-content-dim line-clamp-2 text-xs leading-relaxed">{{ event().playText }}</p>
  `,
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
