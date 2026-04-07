import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { OPPONENT_SHORTHANDS } from '@ws/core/util';

const SHORTHAND_LOOKUP = new Map(Object.entries(OPPONENT_SHORTHANDS).map(([k, v]) => [k.toLowerCase(), v]));

@Pipe({
  name: 'opponentName',
  standalone: true,
})
export class OpponentNamePipe implements PipeTransform {
  transform(value: string): string {
    const shorthand = SHORTHAND_LOOKUP.get(value.toLowerCase());

    if (shorthand) {
      return shorthand;
    }

    // Fallback: strip common institutional suffixes
    return value
      .replace(/\b(University|College|Institute|State)\b/gi, '')
      .replace(/\bOf\b/gi, '')
      .replace(/\bSuny\b/gi, 'SUNY')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
