import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { StolenBaseSummary } from '@ws/core/models';
import { StatCard } from '@ws/core/ui';

@Component({
  selector: 'ws-baserunning-section',
  standalone: true,
  imports: [
    DecimalPipe,
    StatCard,
  ],
  templateUrl: './baserunning-section.html',
  host: { class: 'flex flex-col gap-6' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaserunningSection {
  readonly stolenBaseSummary = input<StolenBaseSummary | null>(null);

  readonly stolenBasesExpanded = signal(false);

  toggleStolenBases(): void {
    this.stolenBasesExpanded.update((v) => !v);
  }

  readonly filteredByBase = computed(() => {
    const sb = this.stolenBaseSummary();

    if (!sb) {
      return [];
    }

    return sb.byBase.filter((row) => row.total > 0);
  });
}
