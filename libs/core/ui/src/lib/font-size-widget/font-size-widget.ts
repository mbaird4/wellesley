import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StyleReader } from '@ws/core/util';

const getSize = (key: string) => StyleReader.convertUnitToRaw(StyleReader.read(key));

const STORAGE_KEY = 'ws-font-size';
const DEFAULT_SIZE = getSize('--text-default-size');
const MIN_SIZE = getSize('--text-min-size');
const MAX_SIZE = getSize('--text-max-size');

@Component({
  selector: 'ws-font-size-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed bottom-[0.8rem] right-[0.8rem] z-50 print:hidden' },
  templateUrl: './font-size-widget.html',
})
export class FontSizeWidget {
  protected readonly open = signal(false);
  protected readonly fontSize = signal(DEFAULT_SIZE);

  protected readonly min = MIN_SIZE;
  protected readonly max = MAX_SIZE;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const size = stored ? Number(stored) : DEFAULT_SIZE;

    this.fontSize.set(size);
    this.applySize(size);
  }

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected setSize(size: number): void {
    const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));

    this.fontSize.set(clamped);
    this.applySize(clamped);
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  protected reset(): void {
    this.setSize(DEFAULT_SIZE);
  }

  protected onSlider(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);

    this.setSize(value);
  }

  private applySize(size: number): void {
    document.documentElement.style.fontSize = `${size}px`;
  }
}
