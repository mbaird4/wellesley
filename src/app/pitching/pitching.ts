import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { mergePitchingYears, RosterService, SoftballDataService } from '@ws/core/data';
import { type PitchingData, type YearPitchingData } from '@ws/core/models';
import { LastUpdatedPipe } from '@ws/core/ui';
import { RECENT_YEARS } from '@ws/core/util';
import { PitcherAnalysis } from '@ws/pitching';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'ws-pitching',
  standalone: true,
  imports: [LastUpdatedPipe, PitcherAnalysis],
  host: { class: 'block stats-section' },
  templateUrl: './pitching.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pitching implements OnInit {
  private readonly dataService = inject(SoftballDataService);
  private readonly rosterService = inject(RosterService);

  readonly pitchingData = signal<PitchingData | null>(null);
  readonly rosterNames = this.rosterService.wellesleyRosterNames;
  readonly jerseyMap = this.rosterService.wellesleyJerseyMap;
  readonly loading = signal(true);

  ngOnInit(): void {
    this.loadPitchingData();
  }

  private loadPitchingData(): void {
    const requests = RECENT_YEARS.map((year) => this.dataService.getWellesleyPitchingData(year).pipe(catchError(() => of(null))));

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
}
