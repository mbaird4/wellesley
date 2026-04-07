import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LastUpdatedPipe } from '@ws/core/ui';
import { BreakpointService } from '@ws/core/util';

import { OpponentDataService } from '../opponent-data.service';

@Component({
  selector: 'ws-opponent-detail',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LastUpdatedPipe,
  ],
  providers: [OpponentDataService],
  host: { class: 'stagger-children flex min-w-0 flex-1 flex-col print:block' },
  templateUrl: './opponent-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpponentDetail {
  readonly data = inject(OpponentDataService);
  readonly bp = inject(BreakpointService);

  readonly tabs = [
    { path: 'spray', label: 'Spray Chart', mobileLabel: 'Spray Chart' },
    { path: 'pitching', label: 'Pitching', mobileLabel: 'Pitching' },
    { path: 'woba', label: 'wOBA', mobileLabel: 'wOBA Stats' },
    { path: 'vs-wellesley', label: 'vs Wellesley', mobileLabel: 'vs Blue' },
    { path: 'stats', label: 'Season Stats', mobileLabel: 'Stats' },
    { path: 'approach', label: 'Approach', mobileLabel: 'Approach' },
  ];
}
