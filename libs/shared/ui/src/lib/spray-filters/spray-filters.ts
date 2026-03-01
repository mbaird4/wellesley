import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ContactQuality, ContactType, SprayOutcome } from '@ws/stats-core';

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

/** Returns the set of contact types compatible with the current outcome + quality selections. */
export function computeAllowedContacts(state: SprayFilterState): Set<ContactType> {
  let allowed = new Set(ALL_CONTACT_TYPES);

  const hasHit = state.outcomes.includes('hit');
  const hasOut = state.outcomes.includes('out') || state.outcomes.includes('error');

  if (hasHit !== hasOut) {
    const fromOutcome: Set<ContactType> = hasHit
      ? new Set(['hit', 'bunt'])
      : new Set(['line_out', 'ground_ball', 'popup', 'bunt']);
    allowed = new Set([...allowed].filter((ct) => fromOutcome.has(ct)));
  }

  const hasHard = state.contactQualities.includes('hard');
  const hasWeak = state.contactQualities.includes('weak');

  if (hasHard !== hasWeak) {
    const fromQuality: Set<ContactType> = hasHard
      ? new Set(['hit', 'line_out', 'bunt'])
      : new Set(['ground_ball', 'popup']);
    allowed = new Set([...allowed].filter((ct) => fromQuality.has(ct)));
  }

  return allowed;
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

  readonly disabledContactTypes = computed(() => {
    const allowed = computeAllowedContacts(this.filters());

    return ALL_CONTACT_TYPES.filter((ct) => !allowed.has(ct));
  });

  onPlayerChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterChange.emit({
      ...this.filters(),
      playerName: value === '' ? null : value,
    });
  }

  onOutcomeChange(values: string[] | string): void {
    this.filterChange.emit({ ...this.filters(), outcomes: values as SprayOutcome[] });
  }

  onContactChange(values: string[] | string): void {
    this.filterChange.emit({ ...this.filters(), contactTypes: values as ContactType[] });
  }

  onQualityChange(values: string[] | string): void {
    this.filterChange.emit({ ...this.filters(), contactQualities: values as ContactQuality[] });
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
