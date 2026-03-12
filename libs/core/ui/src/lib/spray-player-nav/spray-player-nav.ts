import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'ws-spray-player-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bg-surface-card border-line sticky top-20 flex max-h-[70vh] w-44 shrink-0 flex-col gap-0.5 self-start overflow-y-auto rounded-xl border p-1.5 print:hidden',
  },
  template: `
    @for (player of players(); track player) {
      <button (click)="playerChange.emit(player)" class="flex cursor-pointer items-baseline gap-1.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-left text-sm font-medium transition-[color,background,border-color] duration-150" [class]="selectedPlayer() === player ? 'bg-brand-bg text-brand-text border-l-brand' : 'text-content-muted hover:text-content-bright hover:bg-surface-hover bg-transparent'">
        <span class="text-content-dim text-xs font-medium tabular-nums">
          {{ jerseyMap()[player] }}
        </span>
        <span>{{ player }}</span>
      </button>
    }
  `,
})
export class SprayPlayerNav {
  readonly players = input.required<string[]>();
  readonly jerseyMap = input.required<Record<string, number>>();
  readonly selectedPlayer = input<string | null>(null);

  readonly playerChange = output<string>();
}
