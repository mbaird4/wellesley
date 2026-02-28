import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { OpponentTeam, OpponentDisplayRow } from './opponent-types';
import { calculateWoba, getWobaTier } from '../../lib/woba';
import { WobaTier } from '../../lib/types';

interface TeamEntry {
  slug: string;
  name: string;
}

@Component({
  selector: 'app-opponents',
  standalone: true,
  imports: [CommonModule],
  host: { class: 'block stats-section' },
  templateUrl: './opponents.component.html',
})
export class OpponentsComponent {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  readonly teams: TeamEntry[] = [
    { slug: 'wpi', name: 'WPI' },
    { slug: 'wheaton', name: 'Wheaton' },
    { slug: 'springfield', name: 'Springfield' },
    { slug: 'smith', name: 'Smith' },
    { slug: 'salve', name: 'Salve Regina' },
    { slug: 'mit', name: 'MIT' },
    { slug: 'emerson', name: 'Emerson' },
    { slug: 'coastguard', name: 'Coast Guard' },
    { slug: 'clark', name: 'Clark' },
    { slug: 'babson', name: 'Babson' },
  ];

  selectedSlug = this.teams[0].slug;
  teamData: OpponentTeam | null = null;
  displayRows: OpponentDisplayRow[] = [];
  allYears: number[] = [];
  loading = false;
  error: string | null = null;
  expandedPlayer: string | null = null;
  sortKey: 'name' | 'career' = 'career';
  sortDir: 'asc' | 'desc' = 'desc';

  constructor() {
    this.loadTeam(this.selectedSlug);
  }

  get selectedTeamName(): string {
    return this.teams.find((t) => t.slug === this.selectedSlug)?.name ?? '';
  }

  selectTeam(slug: string): void {
    if (slug === this.selectedSlug) return;
    this.selectedSlug = slug;
    this.loadTeam(slug);
  }

  loadTeam(slug: string): void {
    this.loading = true;
    this.error = null;
    this.expandedPlayer = null;

    this.http.get<OpponentTeam>(`/data/opponents/${slug}-historical-stats.json`).subscribe({
      next: (data) => {
        this.teamData = data;
        this.buildDisplayRows(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.message || 'Failed to load team data';
        this.loading = false;
        this.teamData = null;
        this.displayRows = [];
        this.allYears = [];
        this.cdr.markForCheck();
      },
    });
  }

  togglePlayer(name: string): void {
    this.expandedPlayer = this.expandedPlayer === name ? null : name;
  }

  sort(key: 'name' | 'career'): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = key === 'career' ? 'desc' : 'asc';
    }
    this.applySort();
  }

  sortByYear(year: number): void {
    const dir = this.sortDir === 'asc' ? 'desc' : 'asc';
    this.sortKey = 'career'; // reset to avoid confusion
    this.sortDir = dir;
    this.displayRows = [...this.displayRows].sort((a, b) => {
      const aWoba = a.seasons.find((s) => s.year === year)?.woba ?? -1;
      const bWoba = b.seasons.find((s) => s.year === year)?.woba ?? -1;
      return (dir === 'asc' ? 1 : -1) * (aWoba - bWoba);
    });
  }

  tierClass(tier: WobaTier | string): string {
    return `tier-${tier}`;
  }

  formatWoba(value: number): string {
    return value.toFixed(3).replace(/^0/, '');
  }

  getWobaTier = getWobaTier;

  wobaGradientStyle(woba: number): Record<string, string> {
    const stops: [number, number, number, number][] = [
      [0.000, 0, 85, 72],
      [0.150, 10, 85, 70],
      [0.220, 22, 88, 68],
      [0.260, 32, 90, 66],
      [0.290, 42, 90, 64],
      [0.310, 55, 88, 62],
      [0.330, 68, 82, 60],
      [0.350, 85, 78, 58],
      [0.370, 105, 72, 58],
      [0.400, 130, 68, 58],
      [0.450, 145, 72, 55],
      [0.550, 155, 78, 52],
    ];

    const w = Math.max(0, Math.min(0.55, woba));
    let i = 0;
    while (i < stops.length - 1 && stops[i + 1][0] <= w) i++;
    const [w0, h0, s0, l0] = stops[i];
    const [w1, h1, s1, l1] = stops[Math.min(i + 1, stops.length - 1)];
    const t = w1 > w0 ? (w - w0) / (w1 - w0) : 0;
    const h = h0 + t * (h1 - h0);
    const s = s0 + t * (s1 - s0);
    const l = l0 + t * (l1 - l0);

    const topColor = `hsl(${h + 8}, ${s + 5}%, ${l + 14}%)`;
    const bottomColor = `hsl(${h}, ${s}%, ${l}%)`;
    return {
      background: `linear-gradient(to bottom, ${topColor}, ${bottomColor})`,
      '-webkit-background-clip': 'text',
      'background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
    };
  }

  abbreviateClassYear(classYear: string): string {
    const map: Record<string, string> = {
      Freshman: 'Fr',
      Sophomore: 'So',
      Junior: 'Jr',
      Senior: 'Sr',
      'Graduate Student': 'Gr',
    };
    return map[classYear] ?? classYear;
  }

  private buildDisplayRows(data: OpponentTeam): void {
    // Collect all unique years across all players, sorted ascending
    const yearSet = new Set<number>();
    for (const player of data.players) {
      for (const season of player.seasons) {
        yearSet.add(season.year);
      }
    }
    this.allYears = Array.from(yearSet).sort((a, b) => a - b);

    this.displayRows = data.players.map((player) => {
      // Sort player seasons by year ascending for cumulative calculation
      const sortedSeasons = [...player.seasons].sort((a, b) => a.year - b.year);

      // Build cumulative stats year by year
      const accum = { ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 };
      const cumulativeByYear = sortedSeasons.map((s) => {
        accum.ab += s.ab;
        accum.h += s.h;
        accum.doubles += s.doubles;
        accum.triples += s.triples;
        accum.hr += s.hr;
        accum.bb += s.bb;
        accum.hbp += s.hbp;
        accum.sf += s.sf;
        accum.sh += s.sh;
        const pa = accum.ab + accum.bb + accum.sf + accum.sh + accum.hbp;
        return {
          year: s.year,
          woba: calculateWoba({ ...accum }),
          pa,
        };
      });

      return {
        name: player.name,
        jerseyNumber: player.jerseyNumber,
        classYear: player.classYear,
        seasons: sortedSeasons,
        cumulativeByYear,
        career: player.career,
      };
    });

    this.applySort();
  }

  getSeasonForYear(row: OpponentDisplayRow, year: number) {
    return row.seasons.find((s) => s.year === year) ?? null;
  }

  getCumulativeForYear(row: OpponentDisplayRow, year: number) {
    return row.cumulativeByYear.find((c) => c.year === year) ?? null;
  }

  getCumulativeLabel(row: OpponentDisplayRow, year: number): string {
    const idx = row.cumulativeByYear.findIndex((c) => c.year === year);
    if (idx <= 0) return `${year}`;
    return `${row.cumulativeByYear[0].year}\u2013${String(year).slice(2)}`;
  }

  private applySort(): void {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    this.displayRows = [...this.displayRows].sort((a, b) => {
      if (this.sortKey === 'name') {
        return dir * a.name.localeCompare(b.name);
      }
      return dir * (a.career.woba - b.career.woba);
    });
  }
}
