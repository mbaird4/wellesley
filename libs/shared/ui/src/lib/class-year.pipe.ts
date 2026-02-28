import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'classYear', standalone: true })
export class ClassYearPipe implements PipeTransform {
  transform(value: string): string {
    if (/^f/i.test(value)) return 'Fy';
    if (/^so/i.test(value)) return 'So';
    if (/^j/i.test(value)) return 'Jr';
    if (/^s/i.test(value)) return 'Sr';
    if (/^g/i.test(value)) return 'Gr';
    return value;
  }
}
