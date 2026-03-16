import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PitchingData, PitchingStats, Roster } from '@ws/core/models';
import { range } from '@ws/core/util';

const CARDS_PER_PAGE = 3;
const PITCH_TYPES = ['Fast', 'Change', 'Screw', 'Curve', 'Drop', 'Rise', 'Crop', 'Scrize'];

const STAT_DEFS: { key: keyof PitchingStats; label: string }[] = [
  { key: 'era', label: 'ERA' },
  { key: 'ip', label: 'IP' },
  { key: 'bb', label: 'BB' },
  { key: 'so', label: 'SO' },
  { key: 'wp', label: 'WP' },
];

interface StatDisplay {
  label: string;
  prevValue: string;
  currValue: string;
}

interface PitcherCard {
  name: string;
  jersey: number | null;
  throwsLabel: string;
  prevYear: number;
  currYear: number;
  stats: StatDisplay[];
}

function formatStatValue(stats: PitchingStats | null, key: keyof PitchingStats): string {
  if (!stats) {
    return '___';
  }

  const val = stats[key] ?? 0;

  if (key === 'era') {
    return (val as number).toFixed(2);
  }

  return String(val);
}

@Component({
  selector: 'ws-pitcher-scouting-print-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block text-black bg-white' },
  templateUrl: './pitcher-scouting-print-view.html',
})
export class PitcherScoutingPrintView {
  readonly pitchingData = input<PitchingData | null>(null);
  readonly roster = input<Roster | null>(null);
  readonly rosterNames = input<Set<string>>(new Set());
  readonly title = input('');

  readonly pitchTypes = PITCH_TYPES;
  readonly noteLines = range(6);
  readonly strategyLines = range(6);

  readonly printDate = computed(() => {
    const d = new Date();

    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  });

  readonly currYear = computed(() => new Date().getFullYear());
  readonly prevYear = computed(() => this.currYear() - 1);

  readonly pitcherCards = computed<PitcherCard[]>(() => {
    const data = this.pitchingData();
    const roster = this.roster();
    const rosterNames = this.rosterNames();

    if (!data || rosterNames.size === 0) {
      return [];
    }

    const currYear = this.currYear();
    const prevYear = this.prevYear();
    const currStats = data.pitchingStatsByYear[String(currYear)] ?? [];
    const prevStats = data.pitchingStatsByYear[String(prevYear)] ?? [];

    const allPitchers = [...currStats, ...prevStats];
    const seen = new Set<string>();
    const names: string[] = [];

    allPitchers.forEach((p) => {
      const key = p.name.toLowerCase().replace(/\./g, '');

      if (!seen.has(key) && rosterNames.has(key)) {
        seen.add(key);
        names.push(p.name);
      }
    });

    return names.map<PitcherCard>((name) => {
      const key = name.toLowerCase().replace(/\./g, '');
      const rosterEntry = roster ? Object.entries(roster).find(([k]) => k === key)?.[1] : null;
      const prev = prevStats.find((p) => p.name === name) ?? null;
      const curr = currStats.find((p) => p.name === name) ?? null;

      const stats = STAT_DEFS.map((def) => ({
        label: def.label,
        prevValue: formatStatValue(prev, def.key),
        currValue: formatStatValue(curr, def.key),
      }));

      return {
        name,
        jersey: rosterEntry?.jersey ?? null,
        throwsLabel: rosterEntry?.throws === 'L' ? 'LHP' : 'RHP',
        prevYear,
        currYear,
        stats,
      };
    });
  });

  readonly pages = computed<PitcherCard[][]>(() => {
    const cards = this.pitcherCards();
    const pageCount = Math.ceil(cards.length / CARDS_PER_PAGE);

    return Array.from({ length: pageCount }, (_, i) => cards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE));
  });
}
