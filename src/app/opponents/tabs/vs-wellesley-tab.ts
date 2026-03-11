import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';

import { OpponentDataService } from '../opponent-data.service';
import { VsWellesleyView } from '../vs-wellesley/vs-wellesley-view';

@Component({
  selector: 'ws-vs-wellesley-tab',
  standalone: true,
  imports: [VsWellesleyView],
  host: { class: 'block' },
  template: ` <ws-vs-wellesley-view [data]="data.vsWellesleyData()" [loading]="data.vsWellesleyLoading()" [teamName]="data.selectedTeamName()" [wellesleyRosterNames]="data.wellesleyRosterNames()" [pitcherOrder]="data.wellesleyPitcherOrder()" /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VsWellesleyTab {
  readonly data = inject(OpponentDataService);

  constructor() {
    effect(() => {
      const slug = this.data.slug();

      if (slug) {
        this.data.loadVsWellesley(slug);
      }
    });
  }
}
