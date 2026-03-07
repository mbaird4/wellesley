import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  name: 'boxscoreUrl',
  standalone: true,
})
export class BoxscoreUrlPipe implements PipeTransform {
  transform(value: string): string {
    return value.replace(/^\/wellesleyblue/, 'https://wellesleyblue.com');
  }
}
