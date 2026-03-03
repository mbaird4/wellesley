import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

const PLAY_TYPE_LABELS: Record<string, string> = {
  homer: 'Home Run',
  triple: 'Triple',
  double: 'Double',
  single: 'Single',
  bunt_single: 'Bunt Single',
  sac_fly: 'Sac Fly',
  sac_bunt: 'Sac Bunt',
  walk: 'Walk',
  hbp: 'Hit By Pitch',
  wild_pitch: 'Wild Pitch',
  passed_ball: 'Passed Ball',
  stolen_base: 'Stolen Base',
  fielders_choice: "Fielder's Choice",
  error: 'Error',
  productive_out: 'Productive Out',
  unknown: 'Unknown',
};

@Pipe({
  name: 'formatPlayType',
  standalone: true,
})
export class FormatPlayTypePipe implements PipeTransform {
  transform(value: string): string {
    return PLAY_TYPE_LABELS[value] || value;
  }
}
