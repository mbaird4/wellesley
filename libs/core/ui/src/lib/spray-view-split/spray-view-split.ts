import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { SprayChartSummary, SprayZone } from '@ws/core/models';
import { BreakpointService } from '@ws/core/util';

import { SprayPlayerNav } from '../spray-player-nav/spray-player-nav';
import { SprayYearPanel } from '../spray-year-panel/spray-year-panel';

@Component({
  selector: 'ws-spray-view-split',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    SprayPlayerNav,
    SprayYearPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (bp.gtSm()) {
      <div class="flex">
        <ws-spray-player-nav [players]="players()" [jerseyMap]="jerseyMap()" [disabledPlayers]="disabledPlayers()" [selectedPlayer]="selectedPlayer()" (playerChange)="playerChange.emit($event)" />
        @if (selectedPlayer()) {
          <div class="stagger-children flex min-w-0 flex-1 gap-2">
            @for (year of activeYears(); track year) {
              <ws-spray-year-panel class="min-w-0 basis-1/3" [year]="year" [zones]="summaryByYear().get(year)!.zones" [totalContact]="summaryByYear().get(year)!.totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
            }
          </div>
        } @else {
          <ng-container *ngTemplateOutlet="selectPlayerMsg" />
        }
      </div>
    } @else {
      @if (selectedPlayer()) {
        <div class="stagger-children flex flex-col gap-6">
          @for (year of activeYears(); track year) {
            <ws-spray-year-panel [year]="year" [zones]="summaryByYear().get(year)!.zones" [totalContact]="summaryByYear().get(year)!.totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
          }
        </div>
      } @else {
        <ng-container *ngTemplateOutlet="selectPlayerMsg" />
      }
    }

    <ng-template #selectPlayerMsg>
      <div class="text-content-dim flex flex-1 flex-col items-center justify-center gap-2 py-16">
        <i class="fa-solid fa-baseball text-content-empty text-3xl"></i>
        <span class="text-base"> Select a player to view their spray chart </span>
      </div>
    </ng-template>
  `,
})
export class SprayViewSplit {
  readonly bp = inject(BreakpointService);

  readonly players = input.required<string[]>();
  readonly jerseyMap = input.required<Record<string, number>>();
  readonly disabledPlayers = input<Set<string>>(new Set());
  readonly selectedPlayer = input<string | null>(null);
  readonly activeYears = input.required<number[]>();
  readonly summaryByYear = input.required<Map<number, SprayChartSummary>>();
  readonly highlightZone = input<SprayZone | null>(null);

  readonly playerChange = output<string>();
  readonly zoneHover = output<SprayZone | null>();
  readonly zoneClick = output<SprayZone>();
}
