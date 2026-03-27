import { ChangeDetectionStrategy, Component, computed, input, isDevMode, output, signal } from '@angular/core';
import type { SprayDataPoint, Team } from '@ws/core/models';

import { type PrintOptions, PrintOptionsModal } from '../print-options-modal/print-options-modal';
import { SprayChartCoachPrintView } from '../spray-chart-coach-print-view/spray-chart-coach-print-view';
import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayChartPrintView } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayPacketQuickRef } from '../spray-packet-quick-ref/spray-packet-quick-ref';

export type ViewMode = 'split' | 'combined' | 'contact' | 'scouting';

@Component({
  selector: 'ws-spray-print-orchestrator',
  standalone: true,
  imports: [
    PrintOptionsModal,
    SprayChartCoachPrintView,
    SprayChartPrintView,
    SprayPacketQuickRef,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="relative" [class]="printPreview() ? 'print-preview' : ''">
      @if (printPreview()) {
        <button class="absolute top-0 right-0 text-2xl text-[black]" (click)="printPreview.set(false)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      }
      @if (printDugout()) {
        <ws-spray-chart-print-view [players]="printPlayers()" [title]="printTitle()" [subtitle]="printSubtitle()" [teamData]="teamData()" />
      }
      @if (printCoach()) {
        <ws-spray-chart-coach-print-view [players]="printPlayers()" [title]="printTitle()" [subtitle]="printSubtitle()" [years]="selectedYears()" [viewMode]="viewMode()" [dataByYear]="dataByYear()" [teamData]="teamData()" [needsPageBreak]="printDugout()" />
      }
      @if (printQuickRef()) {
        <ws-spray-packet-quick-ref [players]="printPlayers()" [title]="printTitle()" />
      }
    </div>

    @if (showPrintModal()) {
      <ws-print-options-modal [players]="allPlayerSummaries()" [lineupOrder]="lineupOrder()" [cacheKey]="cacheKey()" [years]="selectedYears()" (confirmed)="onPrintConfirm($event)" (dismissed)="onPrintCancel()" />
    }
  `,
})
export class SprayPrintOrchestrator {
  readonly teamData = input<Team | null>(null);
  readonly allPlayerSummaries = input.required<PrintPlayerSummary[]>();
  readonly lineupOrder = input<Record<string, number>>({});
  readonly printTitle = input('');
  readonly printSubtitle = input('');
  readonly selectedYears = input<string[]>([]);
  readonly hasNonDefaultFilters = input(false);
  readonly cacheKey = input<string>('');
  readonly viewMode = input<ViewMode>('combined');
  readonly dataByYear = input.required<Map<number, SprayDataPoint[]>>();

  readonly filtersReset = output<void>();

  readonly showPrintModal = signal(false);
  readonly printDugout = signal(true);
  readonly printCoach = signal(true);
  readonly printQuickRef = signal(false);
  readonly printPreview = signal(false);
  readonly isDev = isDevMode();
  readonly printSortedPlayers = signal<PrintPlayerSummary[]>([]);

  readonly printPlayers = computed(() => {
    const sorted = this.printSortedPlayers();

    return sorted.length > 0 ? sorted : this.allPlayerSummaries();
  });

  onPrint(): void {
    if (this.teamData()) {
      this.showPrintModal.set(true);

      return;
    }

    this.executePrint();
  }

  onPrintConfirm(opts: PrintOptions): void {
    this.printDugout.set(opts.dugout);
    this.printCoach.set(opts.coach);
    this.printQuickRef.set(opts.quickRef ?? false);

    if (opts.coachPlayers?.length) {
      this.printSortedPlayers.set(opts.coachPlayers);
    }

    this.showPrintModal.set(false);
    setTimeout(() => this.executePrint(), 0);
  }

  onPrintCancel(): void {
    this.showPrintModal.set(false);
  }

  private executePrint(): void {
    if (!this.hasNonDefaultFilters()) {
      window.print();

      return;
    }

    const msg = `Filters are applied: ${this.printSubtitle()}\n\nOK = print with filters\nCancel = reset to all contact and print`;

    if (confirm(msg)) {
      window.print();
    } else {
      this.filtersReset.emit();
      setTimeout(() => window.print(), 0);
    }
  }
}
