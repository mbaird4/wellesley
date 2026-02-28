import { Component, input, output } from '@angular/core';
import { NgStyle } from '@angular/common';
import { OpponentDisplayRow } from './opponent-types';
import { formatWoba, wobaGradientStyle, abbreviateClassYear } from '../../lib/woba-display';
import { PlayerDetailComponent } from './player-detail.component';
import { SortKey, SortDir } from './opponents.component';

@Component({
  selector: 'ws-player-card-list',
  standalone: true,
  imports: [NgStyle, PlayerDetailComponent],
  host: { class: 'block' },
  template: `
    <!-- Sort controls -->
    <div class="flex gap-2 mb-3">
      <button
        (click)="sortChanged.emit('name')"
        class="py-1.5 px-3 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors"
        [class]="sortKey() === 'name' ? 'bg-brand-bg text-brand-text' : 'bg-surface-elevated text-content-muted'"
      >
        Name {{ sortKey() === 'name' ? (sortDir() === 'asc' ? '↑' : '↓') : '' }}
      </button>
      <button
        (click)="sortChanged.emit('career')"
        class="py-1.5 px-3 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors"
        [class]="sortKey() === 'career' ? 'bg-brand-bg text-brand-text' : 'bg-surface-elevated text-content-muted'"
      >
        wOBA {{ sortKey() === 'career' ? (sortDir() === 'asc' ? '↑' : '↓') : '' }}
      </button>
    </div>

    <!-- Player cards -->
    <div class="flex flex-col gap-2">
      @for (row of rows(); track row.name) {
        <div
          class="bg-surface-card border border-line rounded-xl overflow-hidden transition-colors"
          [class.border-line-medium]="expandedPlayer() === row.name"
        >
          <!-- Card header — tap to expand -->
          <button
            (click)="playerToggled.emit(row.name)"
            class="w-full text-left p-card bg-transparent border-none cursor-pointer"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <span class="font-semibold text-content-bright text-base">{{ row.name }}</span>
                  @if (row.jerseyNumber !== null) {
                    <span class="text-content-dim text-sm">#{{ row.jerseyNumber }}</span>
                  }
                  <span class="text-content-dim text-sm">{{ abbrevClassYear(row.classYear) }}</span>
                  <span class="text-[0.65rem] text-content-dim ml-auto">{{ expandedPlayer() === row.name ? '▼' : '▶' }}</span>
                </div>
                <div class="mt-2">
                  <span class="text-2xl font-bold tabular-nums" [ngStyle]="gradientStyle(row.career.woba)">{{ fmtWoba(row.career.woba) }}</span>
                  <span class="text-content-dim text-xs ml-1.5">career</span>
                </div>
                <div class="mt-1.5 text-content-secondary text-sm tabular-nums">
                  {{ row.career.pa }} PA · {{ row.career.gp }} GP
                  @if (row.career.sbAtt > 0) {
                    · {{ row.career.sb }}/{{ row.career.sbAtt }} SB
                  }
                </div>
              </div>
            </div>
          </button>

          <!-- Expanded detail -->
          @if (expandedPlayer() === row.name) {
            <div class="border-t border-line bg-surface-overlay">
              <ws-player-detail [row]="row" />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PlayerCardListComponent {
  readonly rows = input.required<OpponentDisplayRow[]>();
  readonly expandedPlayer = input.required<string | null>();
  readonly sortKey = input.required<SortKey>();
  readonly sortDir = input.required<SortDir>();

  readonly playerToggled = output<string>();
  readonly sortChanged = output<SortKey>();

  readonly fmtWoba = formatWoba;
  readonly gradientStyle = wobaGradientStyle;
  readonly abbrevClassYear = abbreviateClassYear;
}
