import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { Roster, SprayChartSummary, SprayTrend, SprayZone } from '@ws/core/models';
import { BreakpointService } from '@ws/core/util';

import { SprayField } from '../spray-field/spray-field';
import { SprayLegend } from '../spray-legend/spray-legend';
import { SprayPlayerHero } from '../spray-player-hero/spray-player-hero';
import { SprayPlayerNav } from '../spray-player-nav/spray-player-nav';

@Component({
  selector: 'ws-spray-view-combined',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    SprayField,
    SprayLegend,
    SprayPlayerHero,
    SprayPlayerNav,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (bp.gtSm()) {
      <div class="flex">
        <ws-spray-player-nav [players]="players()" [jerseyMap]="jerseyMap()" [disabledPlayers]="disabledPlayers()" [selectedPlayer]="selectedPlayer()" (playerChange)="playerChange.emit($event)" />
        @if (selectedPlayer()) {
          <div class="stagger-children mx-auto flex max-w-5xl flex-1 flex-col gap-2">
            <ng-container *ngTemplateOutlet="combinedContent" />
          </div>
        } @else {
          <ng-container *ngTemplateOutlet="selectPlayerMsg" />
        }
      </div>
    } @else {
      @if (selectedPlayer()) {
        <div class="stagger-children mx-auto flex max-w-5xl flex-col gap-2">
          <ng-container *ngTemplateOutlet="combinedContent" />
        </div>
      } @else {
        <ng-container *ngTemplateOutlet="selectPlayerMsg" />
      }
    }

    <ng-template #combinedContent>
      <ws-spray-player-hero [name]="selectedPlayer()!" [jersey]="jerseyMap()[selectedPlayer()!]" [position]="selectedRosterEntry()?.position" [bats]="selectedRosterEntry()?.bats" [summary]="summary()" [trends]="trends()" />
      <ws-spray-field [zones]="summary().zones" [highlightZone]="highlightZone()" (zoneHover)="zoneHover.emit($event)" (zoneClick)="zoneClick.emit($event)" />
      <div class="flex items-center justify-center gap-4">
        <ws-spray-legend />
      </div>
    </ng-template>

    <ng-template #selectPlayerMsg>
      <div class="text-content-dim flex flex-1 flex-col items-center justify-center gap-2 py-16">
        <i class="fa-solid fa-baseball text-content-empty text-3xl"></i>
        <span class="text-base"> Select a player to view their spray chart </span>
      </div>
    </ng-template>
  `,
})
export class SprayViewCombined {
  readonly bp = inject(BreakpointService);

  readonly players = input.required<string[]>();
  readonly jerseyMap = input.required<Record<string, number>>();
  readonly disabledPlayers = input<Set<string>>(new Set());
  readonly roster = input.required<Roster>();
  readonly selectedPlayer = input<string | null>(null);
  readonly summary = input.required<SprayChartSummary>();
  readonly highlightZone = input<SprayZone | null>(null);
  readonly trends = input<SprayTrend[]>([]);

  readonly selectedRosterEntry = computed(() => {
    const player = this.selectedPlayer();

    if (!player) {
      return null;
    }

    return this.roster()[player] ?? null;
  });

  readonly playerChange = output<string>();
  readonly zoneHover = output<SprayZone | null>();
  readonly zoneClick = output<SprayZone>();
}
