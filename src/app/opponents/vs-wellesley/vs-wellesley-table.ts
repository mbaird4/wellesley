import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { inject } from '@angular/core';
import type { BatterVsStats } from '@ws/core/models';
import { BreakpointService } from '@ws/core/util';

@Component({
  selector: 'ws-vs-wellesley-table',
  standalone: true,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bp.gtSm()) {
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-surface-border text-content-dim border-b text-xs font-semibold uppercase tracking-wider">
              <th class="py-2 pr-3 text-left">Player</th>
              <th class="px-1.5 py-2 text-center">PA</th>
              <th class="px-1.5 py-2 text-center">1B</th>
              <th class="px-1.5 py-2 text-center">2B</th>
              <th class="px-1.5 py-2 text-center">3B</th>
              <th class="px-1.5 py-2 text-center">HR</th>
              <th class="px-1.5 py-2 text-center">BB</th>
              <th class="px-1.5 py-2 text-center">HBP</th>
              <th class="px-1.5 py-2 text-center">K</th>
              <th class="px-1.5 py-2 text-center">GO</th>
              <th class="px-1.5 py-2 text-center">FO</th>
              <th class="px-1.5 py-2 text-center">LO</th>
              <th class="px-1.5 py-2 text-center">PU</th>
              <th class="px-1.5 py-2 text-center">DP</th>
              <th class="px-1.5 py-2 text-center">SF</th>
              <th class="px-1.5 py-2 text-center">SH</th>
            </tr>
          </thead>
          <tbody>
            @for (batter of stats(); track batter.batterName) {
              <tr class="border-surface-border hover:bg-surface-elevated border-b transition-colors">
                <td class="py-2 pr-3 font-medium">{{ batter.batterName }}</td>
                <td class="text-content-bright px-1.5 py-2 text-center font-bold tabular-nums">{{ batter.totalPA }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.singles || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.doubles || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.triples || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.hr || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.walks || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.hbp || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.strikeouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.groundouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.flyouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.lineouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.popups || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.doublePlays || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.sacFlies || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ batter.sacBunts || '—' }}</td>
              </tr>
            }
            @if (totals(); as t) {
              <tr class="border-surface-border bg-surface-overlay border-t-2 font-semibold">
                <td class="py-2 pr-3">Totals</td>
                <td class="text-content-bright px-1.5 py-2 text-center tabular-nums">{{ t.totalPA }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.singles || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.doubles || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.triples || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.hr || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.walks || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.hbp || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.strikeouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.groundouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.flyouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.lineouts || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.popups || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.doublePlays || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.sacFlies || '—' }}</td>
                <td class="px-1.5 py-2 text-center tabular-nums">{{ t.sacBunts || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="flex flex-col gap-3">
        @for (batter of stats(); track batter.batterName) {
          <div class="bg-surface-elevated rounded-lg p-card">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-content-bright font-medium">{{ batter.batterName }}</span>
              <span class="text-content-dim text-xs tabular-nums">{{ batter.totalPA }} PA</span>
            </div>
            <div class="mt-2 grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
              @if (batter.singles) {
                <span class="text-content-muted"
                  >1B: <span class="text-content-secondary tabular-nums">{{ batter.singles }}</span></span
                >
              }
              @if (batter.doubles) {
                <span class="text-content-muted"
                  >2B: <span class="text-content-secondary tabular-nums">{{ batter.doubles }}</span></span
                >
              }
              @if (batter.triples) {
                <span class="text-content-muted"
                  >3B: <span class="text-content-secondary tabular-nums">{{ batter.triples }}</span></span
                >
              }
              @if (batter.hr) {
                <span class="text-content-muted"
                  >HR: <span class="text-content-secondary tabular-nums">{{ batter.hr }}</span></span
                >
              }
              @if (batter.walks) {
                <span class="text-content-muted"
                  >BB: <span class="text-content-secondary tabular-nums">{{ batter.walks }}</span></span
                >
              }
              @if (batter.hbp) {
                <span class="text-content-muted"
                  >HBP: <span class="text-content-secondary tabular-nums">{{ batter.hbp }}</span></span
                >
              }
              @if (batter.strikeouts) {
                <span class="text-content-muted"
                  >K: <span class="text-content-secondary tabular-nums">{{ batter.strikeouts }}</span></span
                >
              }
              @if (batter.groundouts) {
                <span class="text-content-muted"
                  >GO: <span class="text-content-secondary tabular-nums">{{ batter.groundouts }}</span></span
                >
              }
              @if (batter.flyouts) {
                <span class="text-content-muted"
                  >FO: <span class="text-content-secondary tabular-nums">{{ batter.flyouts }}</span></span
                >
              }
              @if (batter.lineouts) {
                <span class="text-content-muted"
                  >LO: <span class="text-content-secondary tabular-nums">{{ batter.lineouts }}</span></span
                >
              }
              @if (batter.popups) {
                <span class="text-content-muted"
                  >PU: <span class="text-content-secondary tabular-nums">{{ batter.popups }}</span></span
                >
              }
              @if (batter.doublePlays) {
                <span class="text-content-muted"
                  >DP: <span class="text-content-secondary tabular-nums">{{ batter.doublePlays }}</span></span
                >
              }
              @if (batter.sacFlies) {
                <span class="text-content-muted"
                  >SF: <span class="text-content-secondary tabular-nums">{{ batter.sacFlies }}</span></span
                >
              }
              @if (batter.sacBunts) {
                <span class="text-content-muted"
                  >SH: <span class="text-content-secondary tabular-nums">{{ batter.sacBunts }}</span></span
                >
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class VsWellesleyTable {
  readonly bp = inject(BreakpointService);
  readonly stats = input.required<BatterVsStats[]>();

  readonly totals = computed(() => {
    const rows = this.stats();

    if (rows.length === 0) {
      return null;
    }

    return rows.reduce<BatterVsStats>(
      (acc, row) => ({
        batterName: 'Totals',
        singles: acc.singles + row.singles,
        doubles: acc.doubles + row.doubles,
        triples: acc.triples + row.triples,
        hr: acc.hr + row.hr,
        walks: acc.walks + row.walks,
        hbp: acc.hbp + row.hbp,
        reached: acc.reached + row.reached,
        strikeouts: acc.strikeouts + row.strikeouts,
        groundouts: acc.groundouts + row.groundouts,
        flyouts: acc.flyouts + row.flyouts,
        lineouts: acc.lineouts + row.lineouts,
        popups: acc.popups + row.popups,
        foulouts: acc.foulouts + row.foulouts,
        doublePlays: acc.doublePlays + row.doublePlays,
        sacBunts: acc.sacBunts + row.sacBunts,
        sacFlies: acc.sacFlies + row.sacFlies,
        totalPA: acc.totalPA + row.totalPA,
      }),
      {
        batterName: 'Totals',
        singles: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        walks: 0,
        hbp: 0,
        reached: 0,
        strikeouts: 0,
        groundouts: 0,
        flyouts: 0,
        lineouts: 0,
        popups: 0,
        foulouts: 0,
        doublePlays: 0,
        sacBunts: 0,
        sacFlies: 0,
        totalPA: 0,
      }
    );
  });
}
