import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

const OUTCOME_LABELS: Record<string, string> = {
  scored: 'Scored',
  advanced: 'Advanced',
  stranded: 'Stranded',
  out: 'Out',
};

const OUTCOME_CLASSES: Record<string, string> = {
  scored: 'text-green-400',
  advanced: 'text-brand-text',
  stranded: 'text-content-dim',
  out: 'text-red-400',
};

@Pipe({
  name: 'formatRunnerOutcome',
  standalone: true,
})
export class FormatRunnerOutcomePipe implements PipeTransform {
  transform(value: string): string {
    return OUTCOME_LABELS[value] || value;
  }
}

@Pipe({
  name: 'runnerOutcomeClass',
  standalone: true,
})
export class RunnerOutcomeClassPipe implements PipeTransform {
  transform(value: string): string {
    return OUTCOME_CLASSES[value] || '';
  }
}
