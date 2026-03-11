import { type AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { asyncScheduler, fromEvent, throttleTime } from 'rxjs';

@Component({
  selector: 'ws-sticky-player-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sticky-player-header sticky z-20 block transition-[background-color,box-shadow,width,margin-left,padding,top] duration-150 w-auto stuck:w-screen stuck:py-2 print:hidden!',
    '[attr.data-state]': 'state()',
    '[style.top]': '"var(--header-height, 0px)"',
    '[style.margin-left.px]': 'isStuck() ? -leftOffset() : null',
  },
  templateUrl: './sticky-player-header.html',
})
export class StickyPlayerHeader implements AfterViewInit {
  readonly name = input.required<string>();
  readonly jerseyNumber = input<number | null>(null);
  readonly subtitle = input<string>('');

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollState = signal<'default' | 'stuck'>('default');
  readonly state = this.scrollState.asReadonly();
  readonly isStuck = computed(() => this.state() === 'stuck');
  readonly leftOffset = signal(0);
  private originalTop = 0;

  ngAfterViewInit(): void {
    const el = this.elementRef.nativeElement;
    const rect = el.getBoundingClientRect();
    this.leftOffset.set(rect.left);
    this.originalTop = rect.top + window.scrollY;

    requestAnimationFrame(() => this.handleScroll());

    fromEvent(window, 'scroll', { passive: true })
      .pipe(throttleTime(10, asyncScheduler, { leading: true, trailing: true }), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.handleScroll());
  }

  private handleScroll(): void {
    const scrollY = Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0);
    const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '0');
    const newState = scrollY + headerHeight >= this.originalTop ? 'stuck' : 'default';

    if (newState !== this.scrollState()) {
      this.scrollState.set(newState);
    }
  }
}
