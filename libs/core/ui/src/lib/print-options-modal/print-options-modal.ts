import {
  ChangeDetectionStrategy,
  Component,
  output,
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
  host: { class: 'fixed inset-0 z-50 flex items-center justify-center' },
  templateUrl: './print-options-modal.html',
})
export class PrintOptionsModal {
  readonly dugout = signal(true);
  readonly coach = signal(true);

  readonly confirmed = output<PrintOptions>();
  readonly dismissed = output<void>();

  onPrint(): void {
    this.confirmed.emit({ dugout: this.dugout(), coach: this.coach() });
  }
}
