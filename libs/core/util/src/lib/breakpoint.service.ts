import type { BreakpointState } from '@angular/cdk/layout';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { StyleReader } from './style-reader.utils';

interface Breakpoint {
  label: string;
  query: string;
}

const LABELS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

@Injectable({
  providedIn: 'root',
})
export class BreakpointService {
  private observer = inject(BreakpointObserver);
  private destroyRef = inject(DestroyRef);

  /** Current largest matching breakpoint */
  readonly activeBreakpoint = signal<string | null>(null);

  readonly xs = computed(() => this.activeBreakpoint() === 'xs');
  readonly sm = computed(() => this.activeBreakpoint() === 'sm');
  readonly md = computed(() => this.activeBreakpoint() === 'md');
  readonly lg = computed(() => this.activeBreakpoint() === 'lg');
  readonly xl = computed(() => this.activeBreakpoint() === 'xl');

  readonly gtSm = computed(() => this.gt('sm'));
  readonly ltMd = computed(() => this.lt('md'));
  readonly gtMd = computed(() => this.gt('md'));
  readonly ltLg = computed(() => this.lt('lg'));
  readonly gtLg = computed(() => this.gt('lg'));

  private breakpoints: Breakpoint[] = [];

  constructor() {
    // Tailwind v4 exposes --breakpoint-sm, --breakpoint-md, etc. as CSS custom properties
    this.breakpoints = [
      { label: 'xs', query: '(min-width: 0px)' },
      {
        label: 'sm',
        query: `(min-width: ${StyleReader.read('--breakpoint-sm') || '40rem'})`,
      },
      {
        label: 'md',
        query: `(min-width: ${StyleReader.read('--breakpoint-md') || '48rem'})`,
      },
      {
        label: 'lg',
        query: `(min-width: ${StyleReader.read('--breakpoint-lg') || '64rem'})`,
      },
      {
        label: 'xl',
        query: `(min-width: ${StyleReader.read('--breakpoint-xl') || '80rem'})`,
      },
      {
        label: '2xl',
        query: `(min-width: ${StyleReader.read('--breakpoint-2xl') || '96rem'})`,
      },
    ];

    const queries = this.breakpoints.map((bp) => bp.query);
    const sub = this.observer
      .observe(queries)
      .subscribe((state: BreakpointState) => {
        const matching = this.breakpoints.filter(
          (bp) => state.breakpoints[bp.query]
        );
        const largest = matching.length
          ? matching[matching.length - 1].label
          : null;
        this.activeBreakpoint.set(largest);
      });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  is(label: string): boolean {
    const active = this.activeBreakpoint();
    if (!active) {
      return false;
    }

    return (
      LABELS.indexOf(active as (typeof LABELS)[number]) >=
      LABELS.indexOf(label as (typeof LABELS)[number])
    );
  }

  gt(label: string): boolean {
    const idx = LABELS.indexOf(label as (typeof LABELS)[number]);

    return idx + 1 < LABELS.length && this.is(LABELS[idx + 1]);
  }

  lt(label: string): boolean {
    const active = this.activeBreakpoint();
    if (!active) {
      return true;
    }

    return (
      LABELS.indexOf(active as (typeof LABELS)[number]) <
      LABELS.indexOf(label as (typeof LABELS)[number])
    );
  }
}
