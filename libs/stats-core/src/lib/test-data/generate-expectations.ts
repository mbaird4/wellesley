/**
 * Generates play-pattern-expectations.json by running the current parser
 * functions against every unique play pattern from the scraped data.
 *
 * Usage: npx tsx src/lib/test-data/generate-expectations.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { ScoringPlayType } from '../models';
import {
  classifyPlay,
  parseBatterAction,
  parseRunnerSubEvent,
} from '../parsing/parse-play';
import { mapBatterResultToScoringType } from '../processing/scoring-plays';

interface PatternEntry {
  pattern: string;
  count: number;
  example: string;
}

interface PatternsFile {
  summary: {
    totalPlays: number;
    totalGames: number;
    years: number[];
    uniquePatterns: number;
  };
  patterns: PatternEntry[];
}

interface RunnerSubEventExpectation {
  playerName: string | null;
  isOut: boolean;
  scored: boolean;
  advancedTo?: 'first' | 'second' | 'third';
  scoringType?: ScoringPlayType;
}

interface Expectation {
  pattern: string;
  count: number;
  example: string;
  playType: string;
  batterAction: {
    result: string;
    advancedTo?: 'first' | 'second' | 'third';
    batterAlsoOut?: boolean;
  } | null;
  runnerSubEvents: RunnerSubEventExpectation[];
  status: 'review' | 'verified' | 'bug';
  notes?: string;
}

const patternsPath = join(
  __dirname,
  '../../../public/data/unique-play-patterns.json'
);
const outputPath = join(__dirname, 'play-pattern-expectations.json');

const patternsFile: PatternsFile = JSON.parse(
  readFileSync(patternsPath, 'utf-8')
);

function deriveScoringType(
  playType: string,
  batterResult: string | null,
  sub: string,
  batterSubEvent: string
): ScoringPlayType {
  const lower = sub.toLowerCase();

  if (playType === 'plate_appearance' && batterResult) {
    let type = mapBatterResultToScoringType(batterResult, sub, batterSubEvent);
    if (lower.includes('error')) {
      type = 'error';
    }

    return type;
  }

  if (playType === 'stolen_base') {
    return lower.includes('error') ? 'error' : 'stolen_base';
  }

  if (playType === 'wild_pitch') {
    const playLower = batterSubEvent.toLowerCase(); // full first sub-event text

    return playLower.includes('passed ball') ? 'passed_ball' : 'wild_pitch';
  }

  return 'unknown';
}

const expectations: Expectation[] = patternsFile.patterns.map((entry) => {
  const { pattern, count, example } = entry;

  const playType = classifyPlay(example);

  // Split on semicolons for sub-event analysis
  const subEvents = example
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim());

  // Parse batter action only for plate appearances
  let batterAction: Expectation['batterAction'] = null;
  if (playType === 'plate_appearance') {
    const raw = parseBatterAction(subEvents[0]);
    batterAction = { result: raw.result };
    if (raw.advancedTo !== undefined) {
      batterAction.advancedTo = raw.advancedTo;
    }

    if (raw.batterAlsoOut !== undefined) {
      batterAction.batterAlsoOut = raw.batterAlsoOut;
    }
  }

  // Parse runner sub-events (everything after the first semicolon)
  const runnerSubEvents: RunnerSubEventExpectation[] = subEvents
    .slice(1)
    .map((sub) => {
      const raw = parseRunnerSubEvent(sub);
      const result: RunnerSubEventExpectation = {
        playerName: raw.playerName,
        isOut: raw.isOut,
        scored: raw.scored,
      };
      if (raw.advancedTo !== undefined) {
        result.advancedTo = raw.advancedTo;
      }

      if (raw.scored) {
        result.scoringType = deriveScoringType(
          playType,
          batterAction?.result ?? null,
          sub,
          subEvents[0]
        );
      }

      return result;
    });

  return {
    pattern,
    count,
    example,
    playType,
    batterAction,
    runnerSubEvents,
    status: 'review' as const,
  };
});

writeFileSync(outputPath, `${JSON.stringify(expectations, null, 2)}\n`);

console.log(`Generated ${expectations.length} expectations to ${outputPath}`);
console.log(`Play type breakdown:`);
const typeCounts = new Map<string, number>();
for (const e of expectations) {
  typeCounts.set(e.playType, (typeCounts.get(e.playType) || 0) + 1);
}

for (const [type, count] of [...typeCounts.entries()].sort(
  (a, b) => b[1] - a[1]
)) {
  console.log(`  ${type}: ${count}`);
}

const scoringTypes = new Map<string, number>();
for (const e of expectations) {
  for (const sub of e.runnerSubEvents) {
    if (sub.scoringType) {
      scoringTypes.set(
        sub.scoringType,
        (scoringTypes.get(sub.scoringType) || 0) + 1
      );
    }
  }
}

if (scoringTypes.size > 0) {
  console.log(`Scoring type breakdown:`);
  for (const [type, count] of [...scoringTypes.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count}`);
  }
}
