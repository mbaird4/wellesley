import type { ElementRef } from '@angular/core';
import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DataContextService } from '@ws/core/data';

const PASSWORD_HASH =
  '0d3e8d6bfcf410ae73561671871f8b258d64529620c2dad88b5c46dbe4790af6';

@Component({
  imports: [RouterModule, FormsModule],
  selector: 'ws-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements AfterViewInit {
  private readonly context = inject(DataContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly headerRef = viewChild<ElementRef<HTMLElement>>('headerEl');

  protected title = 'Wellesley Softball Stats Hub';
  protected authenticated =
    !this.context.isAuthRequired() ||
    sessionStorage.getItem('wellesley-auth') === 'true';

  protected readonly scrolled = signal(false);
  protected password = '';
  protected error = false;

  constructor() {
    const onScroll = () => {
      this.scrolled.set(window.scrollY > 20);
      this.updateHeaderHeight();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() =>
      window.removeEventListener('scroll', onScroll)
    );
  }

  ngAfterViewInit(): void {
    this.updateHeaderHeight();
  }

  private updateHeaderHeight(): void {
    const el = this.headerRef()?.nativeElement;

    if (el) {
      document.documentElement.style.setProperty(
        '--header-height',
        `${el.offsetHeight}px`
      );
    }
  }

  protected async checkPassword() {
    const encoded = new TextEncoder().encode(this.password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hex === PASSWORD_HASH) {
      sessionStorage.setItem('wellesley-auth', 'true');
      this.authenticated = true;
    } else {
      this.error = true;
    }
  }
}
