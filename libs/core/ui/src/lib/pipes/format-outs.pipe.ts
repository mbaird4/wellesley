import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  name: 'formatOuts',
  standalone: true,
})
export class FormatOutsPipe implements PipeTransform {
  transform(value: number): string {
    return value === 1 ? '1 Out' : `${value} Outs`;
  }
}
