import { Component, input, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Diamond } from '../diamond/diamond';
import { PlaySnapshot, BaseRunners } from '@ws/stats-core';

@Component({
  selector: 'ws-game-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, Diamond],
  templateUrl: './game-viewer.html',
})
export class GameViewer {
  snapshots = input.required<PlaySnapshot[]>();

  currentIndex = signal(0);
  slotFilter = signal<number | null>(null);
  played = signal(false);

  filteredSnapshots = computed(() => {
    const slot = this.slotFilter();
    const all = this.snapshots();
    if (slot === null) return all;
    return all.filter(s => s.isPlateAppearance && s.lineupSlot === slot);
  });

  currentSnapshot = computed(() => {
    const filtered = this.filteredSnapshots();
    const idx = this.currentIndex();
    return filtered[idx] ?? null;
  });

  displayedBases = computed<BaseRunners>(() => {
    const snap = this.currentSnapshot();
    if (!snap) return { first: null, second: null, third: null };
    return this.played() ? snap.basesAfter : snap.basesBefore;
  });

  displayedOuts = computed(() => {
    const snap = this.currentSnapshot();
    if (!snap) return 0;
    return this.played() ? snap.outsAfter : snap.outsBefore;
  });

  displayedBatter = computed(() => this.played() ? null : this.currentSnapshot()?.currentBatterName ?? null);
  displayedSlot = computed(() => this.played() ? null : this.currentSnapshot()?.currentBatterSlot ?? null);

  totalFiltered = computed(() => this.filteredSnapshots().length);

  slots = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Group snapshots by inning for the play list
  groupedByInning = computed(() => {
    const filtered = this.filteredSnapshots();
    const groups: { inning: string; plays: { snap: PlaySnapshot; filteredIndex: number }[] }[] = [];
    let currentInning = '';
    let currentGroup: { inning: string; plays: { snap: PlaySnapshot; filteredIndex: number }[] } | null = null;

    filtered.forEach((snap, idx) => {
      if (snap.inning !== currentInning) {
        currentInning = snap.inning;
        currentGroup = { inning: currentInning, plays: [] };
        groups.push(currentGroup);
      }
      currentGroup!.plays.push({ snap, filteredIndex: idx });
    });

    return groups;
  });

  constructor() {
    // Reset index when filter changes
    effect(() => {
      this.slotFilter();
      this.currentIndex.set(0);
    }, { allowSignalWrites: true });
  }

  setSlotFilter(slot: number | null): void {
    this.slotFilter.set(slot);
  }

  goTo(index: number): void {
    const max = this.totalFiltered() - 1;
    this.currentIndex.set(Math.max(0, Math.min(index, max)));
    this.played.set(false);
  }

  prev(): void {
    this.goTo(this.currentIndex() - 1);
  }

  next(): void {
    this.goTo(this.currentIndex() + 1);
  }

  onSliderChange(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.goTo(value);
  }

  /** Play: if before state, show after. If already played, advance to next play's before state. */
  play(): void {
    if (this.played()) {
      // Already showing after — advance to next play's before state
      if (this.currentIndex() < this.totalFiltered() - 1) {
        this.goTo(this.currentIndex() + 1);
      }
    } else {
      this.played.set(true);
    }
  }

  /** Rewind: if after state, go back to before. If already before, go to previous play's before state. */
  rewind(): void {
    if (this.played()) {
      this.played.set(false);
    } else {
      if (this.currentIndex() > 0) {
        this.goTo(this.currentIndex() - 1);
      }
    }
  }
}
