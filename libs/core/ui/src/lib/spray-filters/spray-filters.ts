import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ContactQuality, ContactType, SprayFilters as SprayFilterOptions, SprayOutcome } from '@ws/core/models';

import { ButtonToggle, type ToggleOption } from '../button-toggle/button-toggle';
import { SlideToggle } from '../slide-toggle/slide-toggle';

export interface SprayFilterState {
  playerName: string | null;
  outcomes: SprayOutcome[];
  contactTypes: ContactType[];
  contactQualities: ContactQuality[];
  outCount: number[];
  risp: boolean | null;
}

export const ALL_OUTCOMES: SprayOutcome[] = ['hit', 'out', 'error'];
export const ALL_CONTACT_TYPES: ContactType[] = ['hit', 'line_out', 'ground_ball', 'popup', 'bunt'];
export const ALL_CONTACT_QUALITIES: ContactQuality[] = ['hard', 'weak'];
export const ALL_OUT_COUNTS: number[] = [0, 1, 2];

const HARD_CONTACT_TYPES: Set<ContactType> = new Set(['hit', 'line_out']);
const WEAK_CONTACT_TYPES: Set<ContactType> = new Set(['ground_ball', 'popup']);

/** Contact types reachable from outcome selection alone (bunt is always reachable). */
function outcomeAllowedContacts(state: SprayFilterState): Set<ContactType> {
  const hasHit = state.outcomes.includes('hit');
  const hasOut = state.outcomes.includes('out') || state.outcomes.includes('error');

  if (hasHit !== hasOut) {
    return hasHit ? new Set<ContactType>(['hit', 'bunt']) : new Set<ContactType>(['line_out', 'ground_ball', 'popup', 'bunt']);
  }

  return new Set(ALL_CONTACT_TYPES);
}

/** Returns the set of contact types compatible with the current outcome + quality selections. */
export function computeAllowedContacts(state: SprayFilterState): Set<ContactType> {
  let allowed = outcomeAllowedContacts(state);

  const hasHard = state.contactQualities.includes('hard');
  const hasWeak = state.contactQualities.includes('weak');

  if (hasHard !== hasWeak) {
    const fromQuality: Set<ContactType> = hasHard ? new Set(['hit', 'line_out', 'bunt']) : new Set(['ground_ball', 'popup', 'bunt']);
    allowed = new Set([...allowed].filter((ct) => fromQuality.has(ct)));
  }

  return allowed;
}

/** Returns the set of outcomes compatible with the current quality selection. */
export function computeAllowedOutcomes(state: SprayFilterState): Set<SprayOutcome> {
  const hasHard = state.contactQualities.includes('hard');
  const hasWeak = state.contactQualities.includes('weak');

  if (hasHard !== hasWeak) {
    return hasHard ? new Set<SprayOutcome>(['hit']) : new Set<SprayOutcome>(['out', 'error']);
  }

  return new Set(ALL_OUTCOMES);
}

/** Returns the set of qualities compatible with the current outcome + contact type selections. */
export function computeAllowedQualities(state: SprayFilterState): Set<ContactQuality> {
  const fromOutcome = outcomeAllowedContacts(state);
  const effective = state.contactTypes.filter((ct) => fromOutcome.has(ct));

  const hasHard = effective.some((ct) => HARD_CONTACT_TYPES.has(ct));
  const hasWeak = effective.some((ct) => WEAK_CONTACT_TYPES.has(ct));

  // Only bunt selected — both qualities remain valid
  if (!hasHard && !hasWeak) {
    return new Set(ALL_CONTACT_QUALITIES);
  }

  const allowed = new Set<ContactQuality>();

  if (hasHard) {
    allowed.add('hard');
  }

  if (hasWeak) {
    allowed.add('weak');
  }

  return allowed;
}

/**
 * Apply cross-filter constraints and convert SprayFilterState → SprayFilterOptions
 * suitable for passing to computeSprayZones.
 */
export function computeEffectiveFilters(f: SprayFilterState): SprayFilterOptions {
  return {
    playerName: f.playerName,
    outcomes: f.outcomes.filter((o) => computeAllowedOutcomes(f).has(o)),
    contactTypes: f.contactTypes.filter((ct) => computeAllowedContacts(f).has(ct)),
    contactQualities: f.contactQualities,
    outCount: f.outCount,
    risp: f.risp ?? undefined,
  };
}

@Component({
  selector: 'ws-spray-filters',
  standalone: true,
  imports: [ButtonToggle, SlideToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-4 items-end' },
  templateUrl: './spray-filters.html',
  styleUrl: './spray-filters.scss',
})
export class SprayFilters {
  players = input.required<string[]>();
  filters = input.required<SprayFilterState>();
  hiddenGroups = input<Set<string>>(new Set());

  filterChange = output<SprayFilterState>();

  readonly outcomeOptions: ToggleOption[] = [
    { value: 'hit', label: 'Hits', includes: ['hit'] },
    { value: 'out', label: 'Outs', includes: ['out', 'error'] },
  ];

  readonly contactOptions: ToggleOption[] = [
    { value: 'hit', label: 'Hit' },
    { value: 'line_out', label: 'LO' },
    { value: 'ground_ball', label: 'GB' },
    { value: 'popup', label: 'PU' },
    { value: 'bunt', label: 'Bunt' },
  ];

  readonly qualityOptions: ToggleOption[] = [
    { value: 'hard', label: 'Hard' },
    { value: 'weak', label: 'Weak' },
  ];

  readonly outCountOptions: ToggleOption[] = [
    { value: '0', label: '0 Out' },
    { value: '1', label: '1 Out' },
    { value: '2', label: '2 Out' },
  ];

  readonly selectedPlayer = computed(() => this.filters().playerName);

  readonly outcomeValue = computed(() => this.filters().outcomes as string[]);
  readonly contactValue = computed(() => this.filters().contactTypes as string[]);

  readonly qualityValue = computed(() => this.filters().contactQualities as string[]);

  readonly outCountValue = computed(() => this.filters().outCount.map(String));
  readonly rispActive = computed(() => this.filters().risp === true);

  readonly disabledOutcomes = computed(() => {
    const allowed = computeAllowedOutcomes(this.filters());

    return ALL_OUTCOMES.filter((o) => !allowed.has(o));
  });

  readonly disabledContactTypes = computed(() => {
    const allowed = computeAllowedContacts(this.filters());

    return ALL_CONTACT_TYPES.filter((ct) => !allowed.has(ct));
  });

  readonly disabledQualities = computed(() => {
    const allowed = computeAllowedQualities(this.filters());

    return ALL_CONTACT_QUALITIES.filter((q) => !allowed.has(q));
  });

  onPlayerChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterChange.emit({
      ...this.filters(),
      playerName: value === '' ? null : value,
    });
  }

  onOutcomeChange(values: string[] | string): void {
    this.filterChange.emit({
      ...this.filters(),
      outcomes: values as SprayOutcome[],
    });
  }

  onContactChange(values: string[] | string): void {
    this.filterChange.emit({
      ...this.filters(),
      contactTypes: values as ContactType[],
    });
  }

  onQualityChange(values: string[] | string): void {
    this.filterChange.emit({
      ...this.filters(),
      contactQualities: values as ContactQuality[],
    });
  }

  onOutCountChange(values: string[] | string): void {
    this.filterChange.emit({
      ...this.filters(),
      outCount: (values as string[]).map(Number),
    });
  }

  toggleRisp(): void {
    const current = this.filters().risp;
    this.filterChange.emit({ ...this.filters(), risp: current ? null : true });
  }
}
