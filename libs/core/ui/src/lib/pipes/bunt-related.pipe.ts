import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  name: 'buntRelated',
  standalone: true,
})
export class BuntRelatedPipe implements PipeTransform {
  transform(type: string): boolean {
    return type === 'bunt_single' || type === 'sac_bunt';
  }
}
