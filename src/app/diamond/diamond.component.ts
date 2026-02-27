import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseRunners } from '../../lib/types';

@Component({
  selector: 'app-diamond',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diamond.component.html',
  styleUrl: './diamond.component.scss',
})
export class DiamondComponent {
  bases = input.required<BaseRunners>();
  outs = input<number>(0);
  batterName = input<string | null>(null);
  lineupSlot = input<number | null>(null);

  firstOccupied = computed(() => !!this.bases().first);
  secondOccupied = computed(() => !!this.bases().second);
  thirdOccupied = computed(() => !!this.bases().third);

  outDots = computed(() => {
    const current = this.outs();
    return [0, 1, 2].map(i => i < current);
  });
}
