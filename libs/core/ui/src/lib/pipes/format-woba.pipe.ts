import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  name: 'formatWoba',
  standalone: true,
})
export class FormatWobaPipe implements PipeTransform {
  transform(value: number, pa: number): string {
    if (pa === 0) {
      return '-';
    }

    return value.toFixed(3).replace(/^0/, '');
  }
}
