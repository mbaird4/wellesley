import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { OpponentDataService } from '../opponent-data.service';
import { SeasonStats } from '../season-stats/season-stats';

@Component({
  selector: 'ws-stats-tab',
  standalone: true,
  imports: [SeasonStats],
  host: { class: 'block' },
  template: `<ws-season-stats [slug]="data.dataDir()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsTab {
  readonly data = inject(OpponentDataService);
}
