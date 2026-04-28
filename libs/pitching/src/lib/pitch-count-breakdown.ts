import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PitchCountInningStats } from '@ws/core/models';
import { inningToNumber, wobaColorStyle } from '@ws/core/processors';
import { ExpandablePanel, SlideToggle } from '@ws/core/ui';

const EMPTY_STYLE: Record<string, string> = {};

function fmtPct(numerator: number, denominator: number): string {
  if (denominator === 0) {
    return '—';
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function fmtRatio(strikes: number, balls: number): string {
  if (balls === 0) {
    return strikes > 0 ? `${strikes}:0` : '—';
  }

  const ratio = strikes / balls;

  return `${ratio.toFixed(1)}:1`;
}

export interface PitchCountRow {
  inning: string;
  pa: number;
  pitches: number;
  balls: number;
  strikes: number;
  pitchesPerPa: string;
  sbRatio: string;
  strikePct: string;
  strikePctStyle: Record<string, string>;
  firstPitchStrikePct: string;
  firstPitchStrikePctStyle: Record<string, string>;
  firstPitchSwingMissPct: string;
  firstTwoPitchesStrikePct: string;
  firstTwoPitchesStrikePctStyle: Record<string, string>;
  firstTwoPitchesSwingMissPct: string;
}

@Component({
  selector: 'ws-pitch-count-breakdown',
  standalone: true,
  imports: [ExpandablePanel, SlideToggle],
  host: { class: 'bg-surface-card overflow-hidden rounded-xl' },
  templateUrl: './pitch-count-breakdown.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitchCountBreakdown {
  readonly byInning = input.required<Map<string, PitchCountInningStats>>();
  readonly totals = input.required<PitchCountInningStats>();

  readonly showInfo = signal(false);
  readonly colorCoding = signal(true);

  readonly inningRows = computed<PitchCountRow[]>(() => {
    const showColors = this.colorCoding();
    const entries = Array.from(this.byInning().values()).sort((a, b) => inningToNumber(a.inning) - inningToNumber(b.inning));

    return entries.map((inn) => this.buildRow(inn, showColors));
  });

  readonly totalsRow = computed<PitchCountRow>(() => {
    return this.buildRow(this.totals(), this.colorCoding());
  });

  private buildRow(stats: PitchCountInningStats, showColors: boolean): PitchCountRow {
    const strikePctNum = stats.totalPitches > 0 ? stats.strikes / stats.totalPitches : 0;
    const fp = stats.firstPitchCount > 0 ? stats.firstPitchStrikes / stats.firstPitchCount : 0;
    const ftp = stats.firstTwoPitchesCount > 0 ? stats.firstTwoPitchesStrike / stats.firstTwoPitchesCount : 0;

    return {
      inning: stats.inning,
      pa: stats.pasWithSequence,
      pitches: stats.totalPitches,
      pitchesPerPa: stats.pasWithSequence > 0 ? (stats.totalPitches / stats.pasWithSequence).toFixed(1) : '—',
      balls: stats.balls,
      strikes: stats.strikes,
      sbRatio: fmtRatio(stats.strikes, stats.balls),
      strikePct: fmtPct(stats.strikes, stats.totalPitches),
      strikePctStyle: showColors ? wobaColorStyle(strikePctNum * 0.55) : EMPTY_STYLE,
      firstPitchStrikePct: fmtPct(stats.firstPitchStrikes, stats.firstPitchCount),
      firstPitchStrikePctStyle: showColors ? wobaColorStyle(fp * 0.55) : EMPTY_STYLE,
      firstPitchSwingMissPct: fmtPct(stats.firstPitchSwingMiss, stats.firstPitchCount),
      firstTwoPitchesStrikePct: fmtPct(stats.firstTwoPitchesStrike, stats.firstTwoPitchesCount),
      firstTwoPitchesStrikePctStyle: showColors ? wobaColorStyle(ftp * 0.55) : EMPTY_STYLE,
      firstTwoPitchesSwingMissPct: fmtPct(stats.firstTwoPitchesSwingMiss, stats.firstTwoPitchesCount),
    };
  }
}
