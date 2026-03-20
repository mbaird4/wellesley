import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ws-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bg-error-bg text-error py-cell px-card border-error-border text-scale-[1.05] mb-4 rounded-[10px] border block',
  },
  templateUrl: './error-banner.html',
})
export class ErrorBanner {
  readonly message = input.required<string>();
}
