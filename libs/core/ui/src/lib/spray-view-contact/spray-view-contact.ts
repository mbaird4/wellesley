import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { SprayChartSummary, SprayZone } from '@ws/core/models';
import { BreakpointService } from '@ws/core/util';

import { SprayPlayerNav } from '../spray-player-nav/spray-player-nav';
import { SprayYearPanel } from '../spray-year-panel/spray-year-panel';

interface ContactPanel {
  label: string;
  summary: SprayChartSummary;
}

@Component({
  selector: 'ws-spray-view-contact',
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
            @for (panel of contactPanels(); track panel.label) {
              <ws-spray-year-panel class="min-w-0 basis-1/3" [label]="panel.label" [zones]="panel.summary.zones" [totalContact]="panel.summary.totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
            }
          </div>
        } @else {
          <ng-container *ngTemplateOutlet="selectPlayerMsg" />
        }
      </div>
    } @else {
      @if (selectedPlayer()) {
        <div class="stagger-children flex flex-col gap-6">
          @for (panel of contactPanels(); track panel.label) {
            <ws-spray-year-panel [label]="panel.label" [zones]="panel.summary.zones" [totalContact]="panel.summary.totalContact" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
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
export class SprayViewContact {
  readonly bp = inject(BreakpointService);

  readonly players = input.required<string[]>();
  readonly jerseyMap = input.required<Record<string, number>>();
  readonly disabledPlayers = input<Set<string>>(new Set());
  readonly selectedPlayer = input<string | null>(null);
  readonly contactPanels = input.required<ContactPanel[]>();
  readonly highlightZone = input<SprayZone | null>(null);

  readonly playerChange = output<string>();
  readonly zoneHover = output<SprayZone | null>();
  readonly zoneClick = output<SprayZone>();
}
