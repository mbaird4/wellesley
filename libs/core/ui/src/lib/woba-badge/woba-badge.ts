import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatWoba, getWobaTier, tierClass } from '@ws/core/processors';

@Component({
  selector: 'ws-woba-badge',
  standalone: true,
  host: { class: 'flex items-baseline justify-center gap-1' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './woba-badge.html',
})
export class WobaBadge {
  readonly primary = input.required<number>();
  readonly secondary = input<number>(-1);
  readonly pa = input<number>(-1);

  readonly formattedPrimary = computed(() => formatWoba(this.primary()));
  readonly formattedSecondary = computed(() => {
    const val = this.secondary();

    return val !== undefined ? formatWoba(val) : '';
  });

  readonly secondaryTierClass = computed(() => {
    const val = this.secondary();

    return val !== undefined ? tierClass(getWobaTier(val)) : '';
  });
}
