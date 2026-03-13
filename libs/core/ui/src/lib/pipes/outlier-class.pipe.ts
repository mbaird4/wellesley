import { Pipe, type PipeTransform } from '@angular/core';
import type { BaseSituation } from '@ws/core/models';
import type { OutlierMap } from '@ws/core/processors';

type OutIndex = 0 | 1 | 2 | 'total';

export type OutlierLevel = 'outlier-high-strong' | 'outlier-high-mild' | 'outlier-low-mild' | 'outlier-low-strong';

@Pipe({
  name: 'outlierClass',
  standalone: true,
})
export class OutlierClassPipe implements PipeTransform {
  transform(outlierMap: OutlierMap, slot: number, situation: BaseSituation, outIndex: OutIndex, extraClass = '', visible?: OutlierLevel[]): string {
    const key = `${slot}-${situation}-${outIndex}`;
    const d = outlierMap[key];
    const outlier: OutlierLevel | '' = d === undefined ? '' : d >= 0.5 ? 'outlier-high-strong' : d >= 0.25 ? 'outlier-high-mild' : d <= -0.5 ? 'outlier-low-strong' : d <= -0.25 ? 'outlier-low-mild' : '';
    const filtered = outlier && visible && !visible.includes(outlier) ? '' : outlier;

    return [extraClass, filtered].filter(Boolean).join(' ');
  }
}
