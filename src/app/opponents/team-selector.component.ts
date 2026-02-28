import { Component, input, output } from '@angular/core';
import { TeamEntry } from './opponents.component';

@Component({
  selector: 'ws-team-selector',
  standalone: true,
  host: { class: 'block' },
  template: `
    @if (layout() === 'vertical') {
      <nav class="flex flex-col gap-0.5 shrink-0 w-40">
        @for (team of teams(); track team.slug) {
          <button
            (click)="teamSelected.emit(team.slug)"
            class="py-2 px-3 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer border-none"
            [class]="team.slug === selectedSlug() ? 'bg-brand-bg text-brand-text' : 'bg-transparent text-content-muted hover:text-content-bright hover:bg-surface-hover'"
          >
            {{ team.name }}
          </button>
        }
      </nav>
    } @else {
      <nav class="flex gap-1.5 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
        @for (team of teams(); track team.slug) {
          <button
            (click)="teamSelected.emit(team.slug)"
            class="shrink-0 py-1.5 px-3 rounded-full text-sm font-medium transition-colors cursor-pointer border-none whitespace-nowrap"
            [class]="team.slug === selectedSlug() ? 'bg-brand-bg text-brand-text' : 'bg-surface-elevated text-content-muted hover:text-content-bright'"
          >
            {{ team.name }}
          </button>
        }
      </nav>
    }
  `,
})
export class TeamSelectorComponent {
  readonly teams = input.required<TeamEntry[]>();
  readonly selectedSlug = input.required<string>();
  readonly layout = input<'horizontal' | 'vertical'>('vertical');
  readonly teamSelected = output<string>();
}
