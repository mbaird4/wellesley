import { Pipe, type PipeTransform } from '@angular/core';
import type { BaseSituation } from '@ws/core/models';
import type { OutlierMap } from '@ws/core/processors';

type OutIndex = 0 | 1 | 2 | 'total';

@Pipe({
  name: 'outlierClass',
  standalone: true,
})
export class OutlierClassPipe implements PipeTransform {
  transform(outlierMap: OutlierMap, slot: number, situation: BaseSituation, outIndex: OutIndex, extraClass = ''): string {
    const key = `${slot}-${situation}-${outIndex}`;
    const d = outlierMap[key];
    const outlier = d === undefined ? '' : d >= 0.5 ? 'outlier-high-strong' : d >= 0.25 ? 'outlier-high-mild' : d <= -0.5 ? 'outlier-low-strong' : d <= -0.25 ? 'outlier-low-mild' : '';

    return [extraClass, outlier].filter(Boolean).join(' ');
  }
}
