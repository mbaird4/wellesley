import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'ws-slide-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center' },
  templateUrl: './slide-toggle.html',
})
export class SlideToggle {
  checked = input(false);
  checkedChange = output<boolean>();

  toggle(): void {
    this.checkedChange.emit(!this.checked());
  }
}
