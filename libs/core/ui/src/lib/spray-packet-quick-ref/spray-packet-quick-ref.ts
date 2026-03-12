import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { buildCallouts } from '@ws/core/processors';

import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayField } from '../spray-field/spray-field';

@Component({
  selector: 'ws-spray-packet-quick-ref',
  standalone: true,
  imports: [SprayField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block break-before-page' },
  template: `
    <div class="flex items-baseline justify-between pb-2">
      <h2 class="text-lg font-bold print:text-black">{{ title() }} — Quick Reference</h2>
    </div>

    <div class="grid grid-cols-3 gap-2">
      @for (p of cards(); track p.name) {
        <div class="flex flex-col gap-0.5 border border-gray-200 p-1.5 text-[11px] print:text-black">
          <div class="flex items-baseline gap-1">
            <span class="text-xs font-bold">#{{ p.jersey }}</span>
            <span class="font-semibold">{{ p.name }}</span>
          </div>
          <div class="w-24">
            <ws-spray-field [zones]="p.summary.zones" [highlightZone]="null" />
          </div>
          @if (p.callout) {
            <span class="text-[10px] font-medium text-gray-600">
              {{ p.callout }}
            </span>
          }
        </div>
      }
    </div>
  `,
})
export class SprayPacketQuickRef {
  readonly players = input.required<PrintPlayerSummary[]>();
  readonly title = input('');

  readonly cards = computed(() =>
    this.players().map((p) => {
      const callouts = buildCallouts(p);

      return {
        name: p.name,
        jersey: p.jersey,
        summary: p.summary,
        callout: callouts.length > 0 ? `${callouts[0].icon} ${callouts[0].text}` : null,
      };
    })
  );
}
