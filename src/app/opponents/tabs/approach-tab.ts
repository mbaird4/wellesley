import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import type { BatterSwingStats } from '@ws/core/models';
import { buildWellesleyPitcherSequences, computeBatterSwingStats } from '@ws/core/processors';
import { EmptyState, LoadingState, SwingRateTable } from '@ws/core/ui';

import { OpponentDataService } from '../opponent-data.service';

@Component({
  selector: 'ws-approach-tab',
  standalone: true,
  imports: [
    EmptyState,
    LoadingState,
    SwingRateTable,
  ],
  host: { class: 'block' },
  templateUrl: './approach-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproachTab {
  readonly data = inject(OpponentDataService);

  readonly stats = computed<BatterSwingStats[]>(() => {
    const pd = this.data.pitchingData();

    if (!pd?.games.length) {
      return [];
    }

    const records = buildWellesleyPitcherSequences(pd.games);

    return computeBatterSwingStats(records);
  });

  constructor() {
    effect(() => {
      const slug = this.data.slug();

      if (slug) {
        this.data.loadPitching(this.data.dataDir());
      }
    });
  }
}
