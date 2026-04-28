import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PlayerClutchSummary } from '@ws/core/models';
import { BoxscoreUrlPipe } from '@ws/core/ui';

import { ClutchEventRow } from '../clutch-event-row/clutch-event-row';

@Component({
  selector: 'ws-clutch-game-log',
  standalone: true,
  imports: [BoxscoreUrlPipe, ClutchEventRow],
  host: { class: 'flex flex-col gap-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clutch-game-log.html',
})
export class ClutchGameLog {
  readonly player = input.required<PlayerClutchSummary>();
  readonly expandedGameUrl = signal<string | null>(null);

  readonly sortedGames = computed(() => this.player().games);

  toggleGame(url: string): void {
    this.expandedGameUrl.update((current) => (current === url ? null : url));
  }
}
