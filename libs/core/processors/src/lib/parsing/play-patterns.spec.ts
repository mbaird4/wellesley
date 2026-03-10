import type { ScoringPlayType } from '@ws/core/models';

import { mapBatterResultToScoringType } from '../processing/scoring-plays';
import expectations from '../test-data/play-pattern-expectations.json';
import { classifyPlay, parseBatterAction, parseRunnerSubEvent } from './parse-play';

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

const entries = expectations as Expectation[];

function deriveScoringType(playType: string, batterResult: string | null, sub: string, batterSubEvent: string): ScoringPlayType {
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
    const playLower = batterSubEvent.toLowerCase();

    return playLower.includes('passed ball') ? 'passed_ball' : 'wild_pitch';
  }

  return 'unknown';
}

describe('Play pattern expectations', () => {
  it(`sanity: loaded ${entries.length} patterns`, () => {
    expect(entries.length).toBeGreaterThan(500);
  });

  for (const entry of entries) {
    describe(`"${entry.pattern}" (x${entry.count})`, () => {
      it('classifyPlay', () => {
        expect(classifyPlay(entry.example)).toBe(entry.playType);
      });

      if (entry.batterAction) {
        it('parseBatterAction', () => {
          const subEvents = entry.example
            .replace(/\.$/, '')
            .split(';')
            .map((s) => s.trim());
          const result = parseBatterAction(subEvents[0]);

          expect(result.result).toBe(entry.batterAction!.result);

          if (entry.batterAction!.advancedTo !== undefined) {
            expect(result.advancedTo).toBe(entry.batterAction!.advancedTo);
          }

          if (entry.batterAction!.batterAlsoOut !== undefined) {
            expect(result.batterAlsoOut).toBe(entry.batterAction!.batterAlsoOut);
          }
        });
      }

      if (entry.runnerSubEvents.length > 0) {
        it('parseRunnerSubEvent', () => {
          const subEvents = entry.example
            .replace(/\.$/, '')
            .split(';')
            .map((s) => s.trim());
          const runnerSubs = subEvents.slice(1);

          expect(runnerSubs.length).toBe(entry.runnerSubEvents.length);

          for (let i = 0; i < entry.runnerSubEvents.length; i++) {
            const expected = entry.runnerSubEvents[i];
            const result = parseRunnerSubEvent(runnerSubs[i]);

            expect(result.playerName).toBe(expected.playerName);
            expect(result.isOut).toBe(expected.isOut);
            expect(result.scored).toBe(expected.scored);

            if (expected.advancedTo !== undefined) {
              expect(result.advancedTo).toBe(expected.advancedTo);
            }

            if (expected.scoringType !== undefined) {
              const scoringType = deriveScoringType(entry.playType, entry.batterAction?.result ?? null, runnerSubs[i], subEvents[0]);
              expect(scoringType).toBe(expected.scoringType);
            }
          }
        });
      }
    });
  }
});
