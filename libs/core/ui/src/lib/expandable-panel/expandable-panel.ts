import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ws-expandable-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './expandable-panel.html',
})
export class ExpandablePanel {
  readonly open = input(false);
}
