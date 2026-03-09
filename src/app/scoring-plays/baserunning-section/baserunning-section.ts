import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { RunnerConversionRow, StolenBaseSummary } from '@ws/core/models';
import { FormatSituationPipe } from '@ws/core/ui';

@Component({
  selector: 'ws-baserunning-section',
  standalone: true,
  imports: [
    DecimalPipe,
    FormatSituationPipe,
  ],
  templateUrl: './baserunning-section.html',
  host: { class: 'flex flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaserunningSection {
  readonly stolenBaseSummary = input<StolenBaseSummary | null>(null);
  readonly runnerConversions = input<RunnerConversionRow[]>([]);

  readonly filteredByBase = computed(() => {
    const sb = this.stolenBaseSummary();

    if (!sb) {
      return [];
    }

    return sb.byBase.filter((row) => row.total > 0);
  });
}
