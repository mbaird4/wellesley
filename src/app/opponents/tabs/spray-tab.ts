import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { OpponentDataService } from '../opponent-data.service';
import { OpponentSprayChart } from '../opponent-spray-chart/opponent-spray-chart';

@Component({
  selector: 'ws-spray-tab',
  standalone: true,
  imports: [OpponentSprayChart],
  host: { class: 'block' },
  template: `
    <ws-opponent-spray-chart
      [slug]="data.slug()"
      [teamName]="data.selectedTeamName()"
      [teamData]="data.teamData()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprayTab {
  readonly data = inject(OpponentDataService);
}
