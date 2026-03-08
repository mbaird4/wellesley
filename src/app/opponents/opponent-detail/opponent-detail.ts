import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointService } from '@ws/core/util';

import { OpponentDataService } from '../opponent-data.service';

@Component({
  selector: 'ws-opponent-detail',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
    { path: 'woba', label: 'wOBA', mobileLabel: 'wOBA Stats' },
    { path: 'pitching', label: 'Pitching', mobileLabel: 'Pitching' },
    { path: 'stats', label: 'Season Stats', mobileLabel: 'Stats' },
  ];
}
