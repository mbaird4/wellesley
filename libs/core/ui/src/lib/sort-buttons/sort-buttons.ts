import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SortOption<T extends string = string> {
  key: T;
  label: string;
}

@Component({
  selector: 'ws-sort-buttons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-center gap-2' },
  templateUrl: './sort-buttons.html',
})
export class SortButtons<T extends string = string> {
  readonly options = input.required<SortOption<T>[]>();
  readonly value = model.required<T>();
}
