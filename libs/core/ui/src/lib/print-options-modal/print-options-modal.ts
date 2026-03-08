import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  Renderer2,
  signal,
} from '@angular/core';

export interface PrintOptions {
  dugout: boolean;
  coach: boolean;
}

@Component({
  selector: 'ws-print-options-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './print-options-modal.html',
})
export class PrintOptionsModal {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  readonly dugout = signal(true);
  readonly coach = signal(true);

  readonly confirmed = output<PrintOptions>();
  readonly dismissed = output<void>();

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement as HTMLElement;
      const children = Array.from(host.childNodes);

      // Create a wrapper at the body level to escape stacking contexts
      const wrapper = this.renderer.createElement('div');
      this.renderer.setStyle(wrapper, 'display', 'contents');
      this.renderer.appendChild(document.body, wrapper);

      children.forEach((child) => {
        this.renderer.appendChild(wrapper, child);
      });

      this.destroyRef.onDestroy(() => {
        wrapper.remove();
      });
    });
  }

  onPrint(): void {
    this.confirmed.emit({ dugout: this.dugout(), coach: this.coach() });
  }
}
