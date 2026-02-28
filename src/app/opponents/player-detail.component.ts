import { Component, input } from '@angular/core';
import { OpponentDisplayRow } from './opponent-types';
import { getWobaTier } from '../../lib/woba';
import { formatWoba, tierClass } from '../../lib/woba-display';

@Component({
  selector: 'app-player-detail',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div class="p-card flex gap-6 flex-wrap">
      <!-- Per-season detail -->
      <div>
        <h3 class="text-sm font-semibold text-content-muted uppercase tracking-wide mb-2">Season Breakdown</h3>
        <div class="overflow-x-auto">
          <table class="stats-table game-progression-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>GP</th>
                <th>PA</th>
                <th>AB</th>
                <th>R</th>
                <th>1B</th>
                <th>2B</th>
                <th>3B</th>
                <th>HR</th>
                <th>RBI</th>
                <th>BB</th>
                <th>SO</th>
                <th>HBP</th>
                <th>SB</th>
                <th>AVG</th>
                <th>OBP</th>
                <th>SLG</th>
                <th>OPS</th>
                <th>wOBA</th>
              </tr>
            </thead>
            <tbody>
              @for (season of row().seasons; track season.year) {
                <tr>
                  <td class="font-medium text-content-bright">{{ season.year }}</td>
                  <td>{{ season.gp }}</td>
                  <td>{{ season.pa }}</td>
                  <td>{{ season.ab }}</td>
                  <td>{{ season.r }}</td>
                  <td>{{ season.h - season.doubles - season.triples - season.hr }}</td>
                  <td>{{ season.doubles }}</td>
                  <td>{{ season.triples }}</td>
                  <td>{{ season.hr }}</td>
                  <td>{{ season.rbi }}</td>
                  <td>{{ season.bb }}</td>
                  <td>{{ season.so }}</td>
                  <td>{{ season.hbp }}</td>
                  <td>
                    @if (season.sbAtt > 0) {
                      {{ season.sb }}/{{ season.sbAtt }}
                    } @else {
                      —
                    }
                  </td>
                  <td class="tabular-nums">{{ fmtWoba(season.avg) }}</td>
                  <td class="tabular-nums">{{ fmtWoba(season.obp) }}</td>
                  <td class="tabular-nums">{{ fmtWoba(season.slg) }}</td>
                  <td class="tabular-nums">{{ fmtWoba(season.ops) }}</td>
                  <td class="font-semibold text-center tabular-nums" [class]="getTierClass(season.woba)">
                    {{ fmtWoba(season.woba) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cumulative progression -->
      @if (row().cumulativeByYear.length > 1) {
        <div>
          <h3 class="text-sm font-semibold text-content-muted uppercase tracking-wide mb-2">Cumulative Progression</h3>
          <table class="stats-table game-progression-table">
            <thead>
              <tr>
                <th>Through</th>
                <th>PA</th>
                <th>wOBA</th>
              </tr>
            </thead>
            <tbody>
              @for (cum of row().cumulativeByYear; track cum.year) {
                <tr>
                  <td class="font-medium text-content-bright">{{ getCumulativeLabel(cum.year) }}</td>
                  <td>{{ cum.pa }}</td>
                  <td class="font-semibold text-center tabular-nums" [class]="getTierClass(cum.woba)">
                    {{ fmtWoba(cum.woba) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class PlayerDetailComponent {
  readonly row = input.required<OpponentDisplayRow>();

  readonly fmtWoba = formatWoba;

  getTierClass(woba: number): string {
    return tierClass(getWobaTier(woba));
  }

  getCumulativeLabel(year: number): string {
    const yd = this.row().yearData.get(year);
    return yd?.cumulativeLabel ?? `${year}`;
  }
}
