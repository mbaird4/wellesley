import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import type { DisplayRow } from '@ws/core/models';

@Pipe({
  name: 'seasonWobas',
  standalone: true,
})
export class SeasonWobasPipe implements PipeTransform {
  transform(row: DisplayRow): number[] {
    return row.seasons.map((s) => s.woba);
  }
}
