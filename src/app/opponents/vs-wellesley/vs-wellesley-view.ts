import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BatterVsStats, VsWellesleyData } from '@ws/core/models';
import { ButtonToggle, LoadingState, type ToggleOption } from '@ws/core/ui';

import { VsWellesleyTable } from './vs-wellesley-table';

export type VsMode = 'defense' | 'offense';

const MODE_OPTIONS: ToggleOption[] = [
  { value: 'defense', label: 'Defense' },
  { value: 'offense', label: 'Offense' },
];

/**
 * Check whether a PBP abbreviated name prefix-matches a roster name.
 * Handles boxscore truncation (e.g. "B. DiCampell" vs "B. DiCampello").
 */
function nameMatchesRoster(pbpName: string, rosterName: string): boolean {
  const pIdx = pbpName.indexOf(' ');
  const rIdx = rosterName.indexOf(' ');

  if (pIdx < 0 || rIdx < 0) {
    return false;
  }

  const pInit = pbpName.slice(0, pIdx).toLowerCase().replace(/\./g, '');
  const rInit = rosterName.slice(0, rIdx).toLowerCase().replace(/\./g, '');

  if (pInit !== rInit) {
    return false;
  }

  const pLast = pbpName.slice(pIdx + 1).toLowerCase();
  const rLast = rosterName.slice(rIdx + 1).toLowerCase();

  return rLast.startsWith(pLast) || pLast.startsWith(rLast);
}

/** Check if a PBP batter name matches any name in a roster set. */
function isNameOnRoster(pbpName: string, rosterNames: Set<string>): boolean {
  if (rosterNames.size === 0) {
    return true;
  }

  if (rosterNames.has(pbpName)) {
    return true;
  }

  return [...rosterNames].some((rn) => nameMatchesRoster(pbpName, rn));
}

/** Resolve jersey number for a PBP name from an abbreviated jersey map. */
function resolveJersey(pbpName: string, jerseyMap: Record<string, number>): number | null {
  if (pbpName in jerseyMap) {
    return jerseyMap[pbpName];
  }

  const match = Object.entries(jerseyMap).find(([name]) => nameMatchesRoster(pbpName, name));

  return match?.[1] ?? null;
}

/**
 * Match pitcher names ("Last, First" format from PBP/stats) against
 * roster names (also "last, first" format). Case-insensitive, dot-stripped.
 */
function isPitcherOnRoster(pitcherName: string, rosterNames: Set<string>): boolean {
  if (rosterNames.size === 0) {
    return true;
  }

  const normalized = pitcherName.toLowerCase().replace(/\./g, '');

  return [...rosterNames].some((rn) => rn.toLowerCase().replace(/\./g, '') === normalized);
}

@Component({
  selector: 'ws-vs-wellesley-view',
  standalone: true,
  imports: [
    ButtonToggle,
    LoadingState,
    NgTemplateOutlet,
    VsWellesleyTable,
  ],
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vs-wellesley-view.html',
})
export class VsWellesleyView {
  readonly defenseData = input<VsWellesleyData | null>(null);
  readonly offenseData = input<VsWellesleyData | null>(null);
  readonly loading = input(false);
  readonly pitchingLoading = input(false);
  readonly teamName = input('');
  readonly wellesleyRosterNames = input<Set<string>>(new Set());
  readonly wellesleyAbbrevNames = input<Set<string>>(new Set());
  readonly opponentAbbrevNames = input<Set<string>>(new Set());
  readonly opponentRosterNames = input<Set<string>>(new Set());
  readonly opponentJerseyMap = input<Record<string, number>>({});
  readonly wellesleyJerseyMap = input<Record<string, number>>({});
  readonly wellesleyPitcherOrder = input<string[]>([]);
  readonly opponentPitcherOrder = input<string[]>([]);

  readonly mode = signal<VsMode>('defense');
  readonly selectedPitcher = signal<string | null>(null);
  readonly modeOptions = MODE_OPTIONS;

  readonly activeData = computed<VsWellesleyData | null>(() => (this.mode() === 'defense' ? this.defenseData() : this.offenseData()));

  readonly hasOffenseData = computed(() => {
    const od = this.offenseData();

    return od !== null && od.overall.length > 0;
  });

  readonly filteredPitchers = computed<string[]>(() => {
    const d = this.activeData();

    if (!d) {
      return [];
    }

    if (this.mode() === 'defense') {
      const roster = this.wellesleyRosterNames();
      const order = this.wellesleyPitcherOrder();
      const pitchers = roster.size === 0 ? d.wellesleyPitchers : d.wellesleyPitchers.filter((p) => roster.has(p.toLowerCase().replace(/\./g, '')));
      const pitcherSet = new Set(pitchers);

      return order.filter((p) => pitcherSet.has(p));
    }

    // Offense: filter opponent pitchers by current opponent roster
    const rosterNames = this.opponentRosterNames();
    const order = this.opponentPitcherOrder();
    const pitchers = rosterNames.size === 0 ? d.wellesleyPitchers : d.wellesleyPitchers.filter((p) => isPitcherOnRoster(p, rosterNames));
    const pitcherSet = new Set(pitchers);

    return order.filter((p) => pitcherSet.has(p));
  });

  readonly activePitcher = computed<string | null>(() => this.selectedPitcher() ?? this.filteredPitchers()[0] ?? null);

  readonly displayStats = computed<BatterVsStats[]>(() => {
    const d = this.activeData();

    if (!d) {
      return [];
    }

    const pitcher = this.activePitcher();
    const raw = pitcher === null ? d.overall : (d.byPitcher[pitcher] ?? []);

    // Filter to current roster
    const rosterNames = this.mode() === 'defense' ? this.opponentAbbrevNames() : this.wellesleyAbbrevNames();

    if (rosterNames.size === 0) {
      return raw;
    }

    return raw.filter((b) => isNameOnRoster(b.batterName, rosterNames));
  });

  /** Jersey map resolved from PBP batter names to jersey numbers. */
  readonly resolvedJerseyMap = computed<Record<string, number>>(() => {
    const sourceMap = this.mode() === 'defense' ? this.opponentJerseyMap() : this.wellesleyJerseyMap();
    const result: Record<string, number> = {};

    this.displayStats().forEach((b) => {
      const jersey = resolveJersey(b.batterName, sourceMap);

      if (jersey !== null) {
        result[b.batterName] = jersey;
      }
    });

    return result;
  });

  readonly gameDates = computed(() => {
    const d = this.activeData();

    if (!d) {
      return '';
    }

    return d.games.map((g) => g.date).join(', ');
  });

  readonly gameCount = computed(() => this.activeData()?.games.length ?? 0);

  onModeChange(value: string | string[]): void {
    this.mode.set(value as VsMode);
    this.selectedPitcher.set(null);
  }
}
