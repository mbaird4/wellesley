import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, Renderer2, signal } from '@angular/core';

import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayCoachSortPanel } from '../spray-coach-sort-panel/spray-coach-sort-panel';

export interface PrintOptions {
  dugout: boolean;
  coach: boolean;
  coachPlayers?: PrintPlayerSummary[];
}

@Component({
  selector: 'ws-print-options-modal',
  standalone: true,
  imports: [SprayCoachSortPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './print-options-modal.html',
})
export class PrintOptionsModal {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  readonly players = input<PrintPlayerSummary[]>([]);
  readonly years = input<string[]>([]);

  readonly dugout = signal(true);
  readonly coach = signal(true);
  readonly coachPlayers = signal<PrintPlayerSummary[]>([]);

  readonly confirmed = output<PrintOptions>();
  readonly dismissed = output<void>();

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement as HTMLElement;
      const children = Array.from(host.childNodes);

      // Create a wrapper at the body level to escape stacking contexts
      const wrapper = this.renderer.createElement('div');
      this.renderer.setStyle(wrapper, 'display', 'contents');
      this.renderer.appendChild(document.body, wrapper);

      children.forEach((child) => {
        this.renderer.appendChild(wrapper, child);
      });

      this.destroyRef.onDestroy(() => {
        wrapper.remove();
      });
    });
  }

  onCoachSortChange(players: PrintPlayerSummary[]): void {
    this.coachPlayers.set(players);
  }

  onPrint(): void {
    this.confirmed.emit({
      dugout: this.dugout(),
      coach: this.coach(),
      coachPlayers: this.coachPlayers(),
    });
  }
}
