import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { mergePitchingYears, SoftballDataService } from '@ws/core/data';
import {
  type PitchingData,
  toJerseyMap,
  type YearPitchingData,
} from '@ws/core/models';
import { LastUpdatedPipe } from '@ws/core/ui';
import { PitcherAnalysis } from '@ws/pitching';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

@Component({
  selector: 'ws-pitching',
  standalone: true,
  imports: [
    LastUpdatedPipe,
    PitcherAnalysis,
  ],
  host: { class: 'block stats-section' },
  templateUrl: './pitching.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pitching implements OnInit {
  private readonly dataService = inject(SoftballDataService);

  readonly pitchingData = signal<PitchingData | null>(null);
  readonly rosterNames = signal<Set<string>>(new Set());
  readonly jerseyMap = signal<Record<string, number> | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.loadPitchingData();
    this.loadRoster();
  }

  private loadPitchingData(): void {
    const requests = YEARS.map((year) =>
      this.dataService
        .getWellesleyPitchingData(year)
        .pipe(catchError(() => of(null)))
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const valid = results.filter((r): r is YearPitchingData => r !== null);
        this.pitchingData.set(mergePitchingYears(valid));
        this.loading.set(false);
      },
      error: () => {
        this.pitchingData.set(null);
        this.loading.set(false);
      },
    });
  }

  private loadRoster(): void {
    this.dataService.getRoster().subscribe({
      next: (roster) => {
        this.rosterNames.set(new Set(Object.keys(roster)));
        this.jerseyMap.set(toJerseyMap(roster));
      },
    });
  }
}
