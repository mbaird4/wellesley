import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ws-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'stat-card' },
  templateUrl: './stat-card.html',
})
export class StatCard {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly valueClass = input('');
  readonly valueStyle = input<Record<string, string>>({});
}
