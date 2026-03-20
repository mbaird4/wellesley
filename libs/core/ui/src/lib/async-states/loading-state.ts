import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ws-loading-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'loading-state' },
  templateUrl: './loading-state.html',
})
export class LoadingState {
  readonly message = input('Loading...');
}
