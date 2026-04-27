import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, Renderer2, signal } from '@angular/core';

import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayCoachSortPanel } from '../spray-coach-sort-panel/spray-coach-sort-panel';

export type PrintMode = 'download' | 'drive';

export interface PrintOptions {
  mode: PrintMode;
  dugout: boolean;
  coach: boolean;
  quickRef?: boolean;
  coachPlayers?: PrintPlayerSummary[];
}

const MODE_STORAGE_KEY = 'wellesley.printMode';

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
  readonly lineupOrder = input<Record<string, number>>({});
  readonly cacheKey = input<string>('');
  readonly years = input<string[]>([]);

  readonly mode = signal<PrintMode>(this.loadMode());
  readonly dugout = signal(true);
  readonly coach = signal(true);
  readonly quickRef = signal(false);
  readonly coachPlayers = signal<PrintPlayerSummary[]>([]);

  readonly nothingSelected = computed(() => !this.dugout() && !this.coach() && !this.quickRef());

  readonly actionLabel = computed(() => (this.mode() === 'drive' ? 'Save to Drive' : 'Download'));

  readonly actionIcon = computed(() => (this.mode() === 'drive' ? 'fa-brands fa-google-drive' : 'fa-solid fa-download'));

  readonly actionHint = computed(() => (this.mode() === 'drive' ? 'Each selected report uploads as a separate PDF.' : 'Each selected report downloads as a separate PDF.'));

  readonly confirmed = output<PrintOptions>();
  readonly dismissed = output<void>();

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement as HTMLElement;
      const children = Array.from(host.childNodes);

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

  setMode(next: PrintMode): void {
    this.mode.set(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* localStorage unavailable */
    }
  }

  onCoachSortChange(players: PrintPlayerSummary[]): void {
    this.coachPlayers.set(players);
  }

  onConfirm(): void {
    this.confirmed.emit({
      mode: this.mode(),
      dugout: this.dugout(),
      coach: this.coach(),
      quickRef: this.quickRef(),
      coachPlayers: this.coachPlayers(),
    });
  }

  private loadMode(): PrintMode {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);

      if (stored === 'download' || stored === 'drive') {
        return stored;
      }
    } catch {
      /* localStorage unavailable */
    }

    return 'download';
  }
}
