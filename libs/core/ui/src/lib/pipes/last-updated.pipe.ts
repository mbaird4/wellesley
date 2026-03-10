import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  name: 'lastUpdated',
  standalone: true,
})
export class LastUpdatedPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const isCurrentYear = date.getFullYear() === now.getFullYear();

    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (isCurrentYear) {
      return `Updated ${month} ${day}, ${time}`;
    }

    return `Updated ${month} ${day}, ${date.getFullYear()}`;
  }
}
