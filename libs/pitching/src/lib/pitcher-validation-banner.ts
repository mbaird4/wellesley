import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PitcherValidationResult } from '@ws/core/models';
import { ExpandablePanel } from '@ws/core/ui';

@Component({
  selector: 'ws-pitcher-validation-banner',
  standalone: true,
  imports: [ExpandablePanel],
  host: { class: 'block' },
  templateUrl: './pitcher-validation-banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherValidationBanner {
  readonly result = input.required<PitcherValidationResult>();
  readonly expanded = signal(false);

  readonly severityClasses = computed(() => {
    const sev = this.result().overallSeverity;

    if (sev === 'error') {
      return 'bg-error-bg text-error border-error-border';
    }

    return 'bg-warning-bg text-warning border-warning-border';
  });

  readonly detailClasses = computed(() => {
    const sev = this.result().overallSeverity;

    if (sev === 'error') {
      return 'bg-error-bg/50 border-error-border';
    }

    return 'bg-warning-bg/50 border-warning-border';
  });

  readonly summaryText = computed(() => {
    const count = this.result().discrepancies.length;

    return `Play-by-play data differs from season stats in ${count} ${count === 1 ? 'category' : 'categories'}`;
  });
}
