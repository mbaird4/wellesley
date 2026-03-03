import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  name: 'isEmpty',
})
export class IsEmptyPipe implements PipeTransform {
  transform(value: object | null | undefined): boolean {
    if (value === null || typeof value === 'undefined') {
      return true; // Consider null or undefined as "empty" in this context
    }

    return Object.keys(value).length === 0;
  }
}
