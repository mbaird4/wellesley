import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { SprayChartSummary, SprayDataPoint, SprayFilters, SprayZone } from '@ws/core/models';
import { computeSprayZones } from '@ws/core/processors';
import { BreakpointService } from '@ws/core/util';

import { CURRENT_YEAR } from '../spray-chart-viewer/spray-chart-viewer';
import { SprayPlayerNav } from '../spray-player-nav/spray-player-nav';
import { SprayYearPanel } from '../spray-year-panel/spray-year-panel';

const LAST_YEAR = CURRENT_YEAR - 1;

@Component({
  selector: 'ws-spray-view-scouting',
  standalone: true,
  imports: [NgTemplateOutlet, SprayPlayerNav, SprayYearPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (bp.gtSm()) {
      <div class="flex">
        <ws-spray-player-nav [players]="players()" [jerseyMap]="jerseyMap()" [disabledPlayers]="disabledPlayers()" [selectedPlayer]="selectedPlayer()" (playerChange)="playerChange.emit($event)" />
        @if (selectedPlayer()) {
          <div class="stagger-children flex min-w-0 flex-1 gap-2">
            <ws-spray-year-panel class="min-w-0 basis-1/3" [label]="thisYearLabel" [zones]="thisYearSummary().zones" [totalContact]="thisYearSummary().totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
            <ws-spray-year-panel class="min-w-0 basis-1/3" [label]="lastYearLabel" [zones]="lastYearSummary().zones" [totalContact]="lastYearSummary().totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
            <ws-spray-year-panel class="min-w-0 basis-1/3" [label]="combinedLabel" [zones]="combinedSummary().zones" [totalContact]="combinedSummary().totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
          </div>
        } @else {
          <ng-container *ngTemplateOutlet="selectPlayerMsg" />
        }
      </div>
    } @else {
      @if (selectedPlayer()) {
        <div class="stagger-children flex flex-col gap-6">
          <ws-spray-year-panel [label]="thisYearLabel" [zones]="thisYearSummary().zones" [totalContact]="thisYearSummary().totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
          <ws-spray-year-panel [label]="lastYearLabel" [zones]="lastYearSummary().zones" [totalContact]="lastYearSummary().totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
          <ws-spray-year-panel [label]="combinedLabel" [zones]="combinedSummary().zones" [totalContact]="combinedSummary().totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
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
export class SprayViewScouting {
  readonly bp = inject(BreakpointService);

  readonly dataByYear = input.required<Map<number, SprayDataPoint[]>>();
  readonly effectiveFilters = input.required<SprayFilters>();
  readonly players = input.required<string[]>();
  readonly jerseyMap = input.required<Record<string, number>>();
  readonly disabledPlayers = input<Set<string>>(new Set());
  readonly selectedPlayer = input<string | null>(null);
  readonly highlightZone = input<SprayZone | null>(null);

  readonly playerChange = output<string>();
  readonly zoneHover = output<SprayZone | null>();
  readonly zoneClick = output<SprayZone>();

  readonly thisYearLabel = String(CURRENT_YEAR);
  readonly lastYearLabel = String(LAST_YEAR);
  readonly combinedLabel = `${LAST_YEAR}–${String(CURRENT_YEAR).slice(2)}`;

  readonly thisYearSummary = computed<SprayChartSummary>(() => computeSprayZones(this.dataByYear().get(CURRENT_YEAR) ?? [], this.effectiveFilters()));

  readonly lastYearSummary = computed<SprayChartSummary>(() => computeSprayZones(this.dataByYear().get(LAST_YEAR) ?? [], this.effectiveFilters()));

  readonly combinedSummary = computed<SprayChartSummary>(() => {
    const data = [...(this.dataByYear().get(CURRENT_YEAR) ?? []), ...(this.dataByYear().get(LAST_YEAR) ?? [])];

    return computeSprayZones(data, this.effectiveFilters());
  });
}
