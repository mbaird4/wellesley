import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { PitcherAnalysis } from '@ws/pitching';

import { OpponentDataService } from '../opponent-data.service';

@Component({
  selector: 'ws-pitching-tab',
  standalone: true,
  imports: [PitcherAnalysis],
  host: { class: 'block' },
  template: `
    <ws-pitcher-analysis
      [pitchingData]="data.pitchingData()"
      [rosterNames]="data.rosterNames()"
      [jerseyMap]="data.jerseyMap()"
      [loading]="data.pitchingLoading()"
      [teamName]="data.selectedTeamName()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitchingTab {
  readonly data = inject(OpponentDataService);

  constructor() {
    effect(() => {
      const slug = this.data.slug();
      if (slug) {
        this.data.loadPitching(this.data.dataDir());
      }
    });
  }
}
