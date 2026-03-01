import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

const SITUATION_LABELS: Record<string, string> = {
  empty: 'Bases Empty',
  first: 'Runner on 1st',
  second: 'Runner on 2nd',
  third: 'Runner on 3rd',
  first_second: '1st & 2nd',
  first_third: '1st & 3rd',
  second_third: '2nd & 3rd',
  loaded: 'Bases Loaded',
};

@Pipe({
  name: 'formatSituation',
  standalone: true,
})
export class FormatSituationPipe implements PipeTransform {
  transform(value: string): string {
    return SITUATION_LABELS[value] || value;
  }
}
