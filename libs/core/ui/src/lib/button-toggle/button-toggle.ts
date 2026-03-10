import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ToggleOption {
  value: string;
  label: string;
  includes?: string[];
}

@Component({
  selector: 'ws-button-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex gap-1 rounded-lg bg-surface-elevated p-1',
  },
  templateUrl: './button-toggle.html',
})
export class ButtonToggle {
  options = input.required<ToggleOption[]>();
  value = input.required<string[] | string>();
  mode = input<'multi' | 'single'>('multi');
  disabledValues = input<string[]>([]);

  valueChange = output<string[] | string>();

  isActive(opt: ToggleOption): boolean {
    const current = this.value();
    const vals = opt.includes ?? [opt.value];

    if (this.mode() === 'single') {
      return current === opt.value;
    }

    const arr = current as string[];

    return vals.every((v) => arr.includes(v));
  }

  isDisabled(opt: ToggleOption): boolean {
    const disabled = this.disabledValues();

    return (opt.includes ?? [opt.value]).some((v) => disabled.includes(v));
  }

  toggle(opt: ToggleOption): void {
    if (this.isDisabled(opt)) {
      return;
    }

    if (this.mode() === 'single') {
      this.valueChange.emit(opt.value);

      return;
    }

    const current = this.value() as string[];
    const vals = opt.includes ?? [opt.value];
    let next: string[];

    if (vals.every((v) => current.includes(v))) {
      next = current.filter((v) => !vals.includes(v));
    } else {
      next = [...new Set([...current, ...vals])];
    }

    this.valueChange.emit(next);
  }
}
