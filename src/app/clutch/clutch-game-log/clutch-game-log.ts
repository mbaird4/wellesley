import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PlayerClutchSummary } from '@ws/core/models';
import { BoxscoreUrlPipe } from '@ws/core/ui';

import { ClutchEventRow } from '../clutch-event-row/clutch-event-row';

@Component({
  selector: 'ws-clutch-game-log',
  standalone: true,
  imports: [
    BoxscoreUrlPipe,
    ClutchEventRow,
  ],
  host: { class: 'flex flex-col gap-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="text-content-secondary text-sm font-semibold tracking-wide uppercase">Game Log — {{ player().name }}</h3>

    <div class="flex flex-col gap-1">
      @for (game of sortedGames(); track game.url) {
        <button class="bg-surface-card hover:bg-surface-hover flex cursor-pointer items-center gap-4 rounded-lg border-none px-card py-2 text-left transition-colors" (click)="toggleGame(game.url)">
          <a [href]="game.url | boxscoreUrl" target="_blank" rel="noopener" class="text-brand-text hover:text-brand-lighter text-sm font-medium" (click)="$event.stopPropagation()">
            {{ game.opponent }}
          </a>
          <span class="text-content-secondary flex gap-3 text-xs tabular-nums">
            <span>{{ game.runnersOnPa }} PA</span>
            <span class="text-green-400">{{ game.drivenIn }} RBI</span>
            <span class="text-content-dim">{{ game.stranded }} LOB</span>
          </span>
        </button>

        @if (expandedGameUrl() === game.url) {
          <div class="border-line bg-surface ml-4 flex flex-col gap-3 rounded-lg border px-card py-3">
            @for (event of game.events; track $index) {
              <ws-clutch-event-row [event]="event" />
              @if (!$last) {
                <hr class="border-line m-0 border-t" />
              }
            }
          </div>
        }
      }
    </div>
  `,
})
export class ClutchGameLog {
  readonly player = input.required<PlayerClutchSummary>();
  readonly expandedGameUrl = signal<string | null>(null);

  readonly sortedGames = computed(() => this.player().games);

  toggleGame(url: string): void {
    this.expandedGameUrl.update((current) => (current === url ? null : url));
  }
}
