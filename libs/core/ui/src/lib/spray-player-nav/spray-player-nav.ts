import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ws-spray-player-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bg-surface-card border-line sticky top-20 flex max-h-[70vh] w-44 shrink-0 flex-col gap-0.5 self-start overflow-y-auto rounded-xl border p-1.5 print:hidden',
  },
  template: `
    @for (player of activePlayers(); track player) {
      <button (click)="playerChange.emit(player)" class="flex cursor-pointer items-baseline gap-1.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-left text-sm font-medium transition-[color,background,border-color] duration-150" [class]="selectedPlayer() === player ? 'bg-brand-bg text-brand-text border-l-brand' : 'text-content-muted hover:text-content-bright hover:bg-surface-hover bg-transparent'">
        <span class="text-content-dim text-xs font-medium tabular-nums">
          {{ jerseyMap()[player] }}
        </span>
        <span>{{ player }}</span>
      </button>
    }
    @if (inactivePlayers().length > 0) {
      <div class="border-line mt-1 border-t pt-1">
        @for (player of inactivePlayers(); track player) {
          <div class="text-content-empty flex items-baseline gap-1.5 rounded-lg px-2.5 py-1.5 text-sm">
            <span class="text-xs tabular-nums">{{ jerseyMap()[player] }}</span>
            <span>{{ player }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class SprayPlayerNav {
  readonly players = input.required<string[]>();
  readonly jerseyMap = input.required<Record<string, number>>();
  readonly disabledPlayers = input<Set<string>>(new Set());
  readonly selectedPlayer = input<string | null>(null);

  readonly activePlayers = computed(() => {
    const disabled = this.disabledPlayers();

    return this.players().filter((p) => !disabled.has(p));
  });

  readonly inactivePlayers = computed(() => {
    const disabled = this.disabledPlayers();

    return this.players().filter((p) => disabled.has(p));
  });

  readonly playerChange = output<string>();
}
