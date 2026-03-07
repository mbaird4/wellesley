import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

export interface CellColumn {
  key: string;
  format: 'int' | 'avg' | 'era' | 'ip';
  dashPairKeys?: [string, string];
}

@Pipe({
  name: 'cellValue',
  standalone: true,
})
export class CellValuePipe implements PipeTransform {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(row: Record<string, any>, col: CellColumn): string {
    if (col.dashPairKeys) {
      const [a, b] = col.dashPairKeys;

      return `${row[a] ?? 0}-${row[b] ?? 0}`;
    }

    const val = row[col.key];

    if (val === null || val === undefined) {
      return '-';
    }

    switch (col.format) {
      case 'avg':
        return val.toFixed(3).replace(/^0\./, '.');
      case 'era':
        return val.toFixed(2);
      default:
        return String(val);
    }
  }
}
