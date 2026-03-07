import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

export type StatFormat = 'int' | 'avg' | 'era' | 'ip';

@Pipe({
  name: 'formatStat',
  standalone: true,
})
export class FormatStatPipe implements PipeTransform {
  transform(value: number | null | undefined, format: StatFormat): string {
    if (value === null || value === undefined) {
      return '-';
    }

    switch (format) {
      case 'int':
        return String(value);
      case 'avg':
        return value.toFixed(3).replace(/^0\./, '.');
      case 'era':
        return value.toFixed(2);
      case 'ip':
        return String(value);
      default:
        return String(value);
    }
  }
}
