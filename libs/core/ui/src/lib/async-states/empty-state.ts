import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ws-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'empty-state' },
  templateUrl: './empty-state.html',
})
export class EmptyState {
  readonly message = input('Pick a season above to get started.');
}
