/**
 * Generates spray-pattern-expectations.json by running spray parsing
 * functions against every unique play pattern from the scraped data.
 *
 * Filters to plate appearances with ball-in-play contact (excludes
 * substitutions, stolen bases, walks, HBP, strikeouts, reached on
 * error/FC, and other non-contact events).
 *
 * Usage: npx tsx libs/stats-core/src/lib/test-data/generate-spray-expectations.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { classifyPlay, parseBatterAction } from '../parsing/parse-play';
import { classifyContactType, parseBuntZone, parseSprayDirection } from '../spray/spray-chart';

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

interface SprayExpectation {
  pattern: string;
  count: number;
  example: string;
  batterResult: string;
  hasDirection: boolean;
  zone: string | null;
  angle: number | null;
  contactType: string;
  isInfield: boolean | null;
  direction: string | null;
}

/** Results that represent ball-in-play contact with meaningful direction */
const SPRAY_RESULTS = new Set([
  'out', 'double_play', 'single', 'bunt_single',
  'double', 'triple', 'homer', 'sac_bunt', 'sac_fly',
]);

const HIT_RESULTS = new Set(['single', 'double', 'triple', 'homer']);

const patternsPath = join(
  process.cwd(),
  'public/data/unique-play-patterns.json'
);
const outputPath = join(__dirname, 'spray-pattern-expectations.json');

const patternsFile: PatternsFile = JSON.parse(
  readFileSync(patternsPath, 'utf-8')
);

const expectations: SprayExpectation[] = patternsFile.patterns
  .filter((entry) => {
    // Only plate appearances
    const playType = classifyPlay(entry.example);
    if (playType !== 'plate_appearance') {
      return false;
    }

    const batterAction = entry.example.split(';')[0].trim();

    // Strikeouts aren't batted balls (including dropped 3rd strikes)
    if (/\bstruck out\b/i.test(batterAction)) {
      return false;
    }

    // Only ball-in-play contact (no BB, HBP, reached/FC, unknown)
    const { result } = parseBatterAction(batterAction);

    return SPRAY_RESULTS.has(result);
  })
  .map((entry) => {
    const { pattern, count, example } = entry;

    const batterAction = example.split(';')[0].trim();
    const { result } = parseBatterAction(batterAction);

    const dirResult = parseSprayDirection(example);
    const baseContactType = classifyContactType(example);
    // Hits get contactType 'hit' unless it's a bunt
    const contactType = HIT_RESULTS.has(result) && baseContactType !== 'bunt'
      ? 'hit'
      : baseContactType;

    // For bunts, use bunt zone parsing (fielder-based, not throw destination)
    if (contactType === 'bunt') {
      const buntDir = parseBuntZone(example);

      return {
        pattern,
        count,
        example,
        batterResult: result,
        hasDirection: true,
        zone: buntDir!.zone,
        angle: buntDir!.angle,
        contactType,
        isInfield: true,
        direction: buntDir!.direction,
      };
    }

    return {
      pattern,
      count,
      example,
      batterResult: result,
      hasDirection: dirResult !== null,
      zone: dirResult?.zone ?? null,
      angle: dirResult?.angle ?? null,
      contactType,
      isInfield: dirResult?.isInfield ?? null,
      direction: dirResult?.direction ?? null,
    };
  });

writeFileSync(outputPath, `${JSON.stringify(expectations, null, 2)}\n`);

const withDirection = expectations.filter((e) => e.hasDirection);
const withoutDirection = expectations.filter((e) => !e.hasDirection);

console.log(`Generated ${expectations.length} spray expectations to ${outputPath}`);
console.log(`  With directional info: ${withDirection.length}`);
console.log(`  Without directional info: ${withoutDirection.length}`);

console.log(`\nBatter result breakdown:`);
const resultCounts = new Map<string, number>();
expectations.forEach((e) => {
  resultCounts.set(e.batterResult, (resultCounts.get(e.batterResult) || 0) + 1);
});
[...resultCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([result, count]) => {
    console.log(`  ${result}: ${count}`);
  });

console.log(`\nZone breakdown:`);
const zoneCounts = new Map<string, number>();
withDirection.forEach((e) => {
  zoneCounts.set(e.zone!, (zoneCounts.get(e.zone!) || 0) + 1);
});
[...zoneCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([zone, count]) => {
    console.log(`  ${zone}: ${count}`);
  });

console.log(`\nContact type breakdown:`);
const contactCounts = new Map<string, number>();
expectations.forEach((e) => {
  contactCounts.set(e.contactType, (contactCounts.get(e.contactType) || 0) + 1);
});
[...contactCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
