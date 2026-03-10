import type { PlaySnapshot } from '@ws/core/models';
import type { SprayDataPoint, SprayZone } from '@ws/core/models';

import expectations from '../test-data/spray-pattern-expectations.json';
import { classifyContactType, computeSprayZones, getContactQuality, parseBuntZone, parseSprayData, parseSprayDirection } from './spray-chart';

// --- Types ---

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

const entries = expectations as SprayExpectation[];

// --- parseSprayDirection expectations ---

describe('Spray pattern expectations', () => {
  it(`sanity: loaded ${entries.length} patterns`, () => {
    expect(entries.length).toBeGreaterThan(300);
  });

  const withDirection = entries.filter((e) => e.hasDirection);
  const withoutDirection = entries.filter((e) => !e.hasDirection);

  it(`has ${withDirection.length} patterns with directional info`, () => {
    expect(withDirection.length).toBeGreaterThan(300);
  });

  it(`has ${withoutDirection.length} patterns without directional info`, () => {
    expect(withoutDirection.length).toBeGreaterThan(10);
  });

  const buntEntries = withDirection.filter((e) => e.contactType === 'bunt');
  const nonBuntEntries = withDirection.filter((e) => e.contactType !== 'bunt');

  for (const entry of nonBuntEntries) {
    describe(`"${entry.pattern}" → ${entry.zone}`, () => {
      it('parseSprayDirection returns correct zone', () => {
        const result = parseSprayDirection(entry.example);
        expect(result).not.toBeNull();
        expect(result!.zone).toBe(entry.zone);
      });

      it('parseSprayDirection returns correct angle', () => {
        const result = parseSprayDirection(entry.example);
        expect(result!.angle).toBe(entry.angle);
      });

      it('parseSprayDirection returns correct isInfield', () => {
        const result = parseSprayDirection(entry.example);
        expect(result!.isInfield).toBe(entry.isInfield);
      });

      it('contact type matches expected', () => {
        expect(entry.contactType).toBeDefined();
      });
    });
  }

  for (const entry of buntEntries) {
    describe(`"${entry.pattern}" → ${entry.zone} (bunt)`, () => {
      it('parseBuntZone returns correct zone', () => {
        const result = parseBuntZone(entry.example);
        expect(result).not.toBeNull();
        expect(result!.zone).toBe(entry.zone);
      });

      it('parseBuntZone returns correct angle', () => {
        const result = parseBuntZone(entry.example);
        expect(result!.angle).toBe(entry.angle);
      });
    });
  }
});

// --- classifyContactType unit tests ---

describe('classifyContactType', () => {
  it('identifies ground balls', () => {
    expect(classifyContactType('A. Player grounded out to ss.')).toBe('ground_ball');
  });

  it('identifies line outs', () => {
    expect(classifyContactType('A. Player lined out to 2b.')).toBe('line_out');
  });

  it('identifies fly balls as popup', () => {
    expect(classifyContactType('A. Player flied out to cf.')).toBe('popup');
  });

  it('identifies popups', () => {
    expect(classifyContactType('A. Player popped up to ss.')).toBe('popup');
  });

  it('identifies bunts', () => {
    expect(classifyContactType('A. Player singled, bunt.')).toBe('bunt');
  });

  it('identifies foul outs as popup', () => {
    expect(classifyContactType('A. Player fouled out to 1b.')).toBe('popup');
  });

  it('identifies infield fly as popup', () => {
    expect(classifyContactType('A. Player infield fly to p.')).toBe('popup');
  });

  it('identifies popped into double play as popup', () => {
    expect(classifyContactType('A. Player popped into double play c to 2b.')).toBe('popup');
  });

  it('identifies out at first to infield as bunt', () => {
    expect(classifyContactType('A. Player out at first 3b to 2b, SAC, bunt.')).toBe('bunt');
    expect(classifyContactType('A. Player out at first p to 2b.')).toBe('bunt');
    expect(classifyContactType('A. Player out at first 1b to 2b.')).toBe('bunt');
  });

  it('identifies out at first to outfield as popup', () => {
    expect(classifyContactType('A. Player out at first lf to cf, SAC.')).toBe('popup');
  });

  it('returns unknown for plain singles', () => {
    expect(classifyContactType('A. Player singled to cf.')).toBe('unknown');
  });

  it('returns unknown for walks', () => {
    expect(classifyContactType('A. Player walked.')).toBe('unknown');
  });
});

// --- parseSprayDirection unit tests ---

describe('parseSprayDirection', () => {
  it('parses outfield directions', () => {
    expect(parseSprayDirection('A. Player singled to cf.')!.zone).toBe('cf');
    expect(parseSprayDirection('A. Player doubled to lf.')!.zone).toBe('lf');
    expect(parseSprayDirection('A. Player tripled to rf.')!.zone).toBe('rf');
  });

  it('parses gap directions', () => {
    expect(parseSprayDirection('A. Player doubled to left center.')!.zone).toBe('lf_cf');
    expect(parseSprayDirection('A. Player doubled to right center.')!.zone).toBe('rf_cf');
    expect(parseSprayDirection('A. Player singled up the middle.')!.zone).toBe('cf');
  });

  it('parses line directions', () => {
    expect(parseSprayDirection('A. Player doubled down the lf line.')!.zone).toBe('lf_line');
    expect(parseSprayDirection('A. Player doubled down the rf line.')!.zone).toBe('rf_line');
  });

  it('parses through-side directions', () => {
    expect(parseSprayDirection('A. Player singled through the left side.')!.zone).toBe('lf_cf');
    expect(parseSprayDirection('A. Player singled through the right side.')!.zone).toBe('rf_cf');
  });

  it('parses infield positions', () => {
    expect(parseSprayDirection('A. Player grounded out to 3b.')!.zone).toBe('if_3b');
    expect(parseSprayDirection('A. Player grounded out to ss.')!.zone).toBe('if_ss');
    expect(parseSprayDirection('A. Player grounded out to 2b.')!.zone).toBe('if_2b');
    expect(parseSprayDirection('A. Player grounded out to 1b.')!.zone).toBe('if_1b');
    expect(parseSprayDirection('A. Player grounded out to p.')!.zone).toBe('if_p');
    expect(parseSprayDirection('A. Player popped up to c.')!.zone).toBe('if_c');
  });

  it('only uses batter action (before semicolon)', () => {
    const result = parseSprayDirection('A. Player singled to cf; B. Runner advanced to third.');
    expect(result!.zone).toBe('cf');
  });

  it('returns null for no directional info', () => {
    expect(parseSprayDirection('A. Player struck out swinging.')).toBeNull();
    expect(parseSprayDirection('A. Player walked.')).toBeNull();
    expect(parseSprayDirection('A. Player hit by pitch.')).toBeNull();
  });
});

// --- parseSprayData integration ---

describe('parseSprayData', () => {
  function makeSnapshot(overrides: Partial<PlaySnapshot>): PlaySnapshot {
    return {
      playIndex: 0,
      inning: '1st',
      playText: '',
      playType: 'plate_appearance',
      basesBefore: { first: null, second: null, third: null },
      outsBefore: 0,
      basesAfter: { first: null, second: null, third: null },
      outsAfter: 0,
      lineupSlot: 1,
      batterName: 'A. Player',
      isPlateAppearance: true,
      currentBatterName: 'A. Player',
      currentBatterSlot: 1,
      scoringPlays: [],
      ...overrides,
    };
  }

  it('extracts spray data from a single with direction', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player singled to cf.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].zone).toBe('cf');
    expect(result[0].outcome).toBe('hit');
    expect(result[0].hitType).toBe('single');
    expect(result[0].contactType).toBe('hit');
  });

  it('classifies non-bunt hits as contact type hit', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player doubled to lf.' }), makeSnapshot({ playText: 'A. Player tripled to rf.' }), makeSnapshot({ playText: 'A. Player homered to cf.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(3);
    result.forEach((r) => {
      expect(r.contactType).toBe('hit');
    });
  });

  it('extracts spray data from a ground out', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player grounded out to ss.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].zone).toBe('if_ss');
    expect(result[0].outcome).toBe('out');
    expect(result[0].contactType).toBe('ground_ball');
  });

  it('skips non-plate-appearances', () => {
    const snapshots = [
      makeSnapshot({
        playText: 'A. Player stole second.',
        isPlateAppearance: false,
        playType: 'stolen_base',
      }),
    ];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(0);
  });

  it('skips plays without directional info (walks, HBP)', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player walked.' }), makeSnapshot({ playText: 'A. Player hit by pitch.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(0);
  });

  it('skips strikeouts even with directional info (dropped 3rd strike)', () => {
    const snapshots = [
      makeSnapshot({ playText: 'A. Player struck out swinging.' }),
      makeSnapshot({
        playText: 'A. Player struck out swinging, out at first c to 1b.',
      }),
      makeSnapshot({ playText: 'A. Player struck out looking.' }),
    ];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(0);
  });

  it('skips reached on error (no contact direction info)', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player reached first on an error by ss.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(0);
  });

  it('skips fielders choice (no contact direction info)', () => {
    const snapshots = [
      makeSnapshot({
        playText: "A. Player reached on a fielder's choice; B. Runner out at second ss to 2b.",
      }),
    ];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(0);
  });

  it('handles bunt singles', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player singled to third base, bunt.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].hitType).toBe('single');
    expect(result[0].contactType).toBe('bunt');
    expect(result[0].zone).toBe('plate_3b');
  });

  it('handles sac bunts with direction', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player grounded out to p, SAC, bunt.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe('out');
    expect(result[0].contactType).toBe('bunt');
    expect(result[0].zone).toBe('plate_p');
  });

  it('handles out-at-first bunts using fielder position', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player out at first 3b to 2b, SAC, bunt.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].contactType).toBe('bunt');
    expect(result[0].zone).toBe('plate_3b');
  });

  it('handles bunts without direction', () => {
    const snapshots = [makeSnapshot({ playText: 'A. Player singled, bunt.' })];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].contactType).toBe('bunt');
    expect(result[0].zone).toBe('plate_p');
  });

  it('populates situational fields from snapshot', () => {
    const snapshots = [
      makeSnapshot({
        playText: 'A. Player singled to cf.',
        outsBefore: 1,
        basesBefore: { first: 'B. Runner', second: 'C. Runner', third: null },
      }),
    ];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].outsBefore).toBe(1);
    expect(result[0].runnersOnBase).toBe(true);
    expect(result[0].risp).toBe(true);
  });

  it('risp is false when runner only on first', () => {
    const snapshots = [
      makeSnapshot({
        playText: 'A. Player doubled to lf.',
        outsBefore: 0,
        basesBefore: { first: 'B. Runner', second: null, third: null },
      }),
    ];
    const result = parseSprayData(snapshots, 0);
    expect(result[0].runnersOnBase).toBe(true);
    expect(result[0].risp).toBe(false);
  });

  it('bases empty gives runnersOnBase false', () => {
    const snapshots = [
      makeSnapshot({
        playText: 'A. Player grounded out to ss.',
        outsBefore: 2,
        basesBefore: { first: null, second: null, third: null },
      }),
    ];
    const result = parseSprayData(snapshots, 0);
    expect(result[0].runnersOnBase).toBe(false);
    expect(result[0].risp).toBe(false);
    expect(result[0].outsBefore).toBe(2);
  });

  it('handles sac flies', () => {
    const snapshots = [
      makeSnapshot({
        playText: 'A. Player flied out to cf, SAC; B. Runner scored.',
      }),
    ];
    const result = parseSprayData(snapshots, 0);
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe('out');
    expect(result[0].zone).toBe('cf');
    expect(result[0].contactType).toBe('popup');
  });
});

// --- computeSprayZones ---

describe('computeSprayZones', () => {
  const testPoints: SprayDataPoint[] = [
    {
      playerName: 'A. Player',
      zone: 'cf' as SprayZone,
      contactType: 'hit',
      outcome: 'hit',
      hitType: 'double',
      direction: 'to cf',
      angle: 90,
      isInfield: false,
      playText: 'A. Player doubled to cf.',
      gameIndex: 0,
      inning: '1st',
      outsBefore: 0,
      runnersOnBase: false,
      risp: false,
    },
    {
      playerName: 'A. Player',
      zone: 'cf' as SprayZone,
      contactType: 'popup',
      outcome: 'out',
      hitType: 'out',
      direction: 'to cf',
      angle: 90,
      isInfield: false,
      playText: 'A. Player flied out to cf.',
      gameIndex: 0,
      inning: '2nd',
      outsBefore: 1,
      runnersOnBase: true,
      risp: true,
    },
    {
      playerName: 'B. Other',
      zone: 'lf' as SprayZone,
      contactType: 'hit',
      outcome: 'hit',
      hitType: 'single',
      direction: 'to lf',
      angle: 150,
      isInfield: false,
      playText: 'B. Other singled to lf.',
      gameIndex: 0,
      inning: '1st',
      outsBefore: 0,
      runnersOnBase: true,
      risp: false,
    },
    {
      playerName: 'A. Player',
      zone: 'if_ss' as SprayZone,
      contactType: 'line_out',
      outcome: 'out',
      hitType: 'out',
      direction: 'to ss',
      angle: 120,
      isInfield: true,
      playText: 'A. Player lined out to ss.',
      gameIndex: 0,
      inning: '3rd',
      outsBefore: 2,
      runnersOnBase: true,
      risp: true,
    },
  ];

  it('aggregates zones correctly', () => {
    const summary = computeSprayZones(testPoints);
    expect(summary.totalContact).toBe(4);

    const cfZone = summary.zones.find((z) => z.zone === 'cf')!;
    expect(cfZone.total).toBe(2);
    expect(cfZone.hits).toBe(1);
    expect(cfZone.outs).toBe(1);
    expect(cfZone.battingAvg).toBeCloseTo(0.5);

    const lfZone = summary.zones.find((z) => z.zone === 'lf')!;
    expect(lfZone.total).toBe(1);
    expect(lfZone.hits).toBe(1);
    expect(lfZone.battingAvg).toBeCloseTo(1.0);
  });

  it('filters by player', () => {
    const summary = computeSprayZones(testPoints, { playerName: 'A. Player' });
    expect(summary.totalContact).toBe(3);
    expect(summary.playerName).toBe('A. Player');
  });

  it('filters by outcome', () => {
    const summary = computeSprayZones(testPoints, { outcomes: ['hit'] });
    expect(summary.totalContact).toBe(2);
  });

  it('filters by contact type', () => {
    const summary = computeSprayZones(testPoints, { contactTypes: ['hit'] });
    expect(summary.totalContact).toBe(2);
  });

  it('filters by contact quality — hard', () => {
    // hard = 'hit' + 'line_out' → 3 data points
    const summary = computeSprayZones(testPoints, {
      contactQualities: ['hard'],
    });
    expect(summary.totalContact).toBe(3);
  });

  it('filters by contact quality — weak', () => {
    // weak = 'popup' + 'ground_ball' → 1 data point (popup in test data)
    const summary = computeSprayZones(testPoints, {
      contactQualities: ['weak'],
    });
    expect(summary.totalContact).toBe(1);
  });

  it('filters by out count', () => {
    const summary = computeSprayZones(testPoints, { outCount: [0] });
    expect(summary.totalContact).toBe(2);
  });

  it('filters by multiple out counts', () => {
    const summary = computeSprayZones(testPoints, { outCount: [1, 2] });
    expect(summary.totalContact).toBe(2);
  });

  it('filters by RISP', () => {
    const summary = computeSprayZones(testPoints, { risp: true });
    expect(summary.totalContact).toBe(2);
  });

  it('combines out count and RISP filters', () => {
    const summary = computeSprayZones(testPoints, {
      outCount: [2],
      risp: true,
    });
    expect(summary.totalContact).toBe(1);
    expect(summary.dataPoints[0].playerName).toBe('A. Player');
  });

  it('handles empty data', () => {
    const summary = computeSprayZones([]);
    expect(summary.totalContact).toBe(0);
    expect(summary.zones).toHaveLength(16);
    summary.zones.forEach((z) => {
      expect(z.total).toBe(0);
      expect(z.pct).toBe(0);
      expect(z.battingAvg).toBe(0);
    });
  });
});

// --- getContactQuality ---

describe('getContactQuality', () => {
  it('classifies hits as hard contact', () => {
    expect(getContactQuality('hit')).toBe('hard');
  });

  it('classifies line outs as hard contact', () => {
    expect(getContactQuality('line_out')).toBe('hard');
  });

  it('classifies ground balls as weak contact', () => {
    expect(getContactQuality('ground_ball')).toBe('weak');
  });

  it('classifies bunts as hard contact', () => {
    expect(getContactQuality('bunt')).toBe('hard');
  });

  it('classifies popups as weak contact', () => {
    expect(getContactQuality('popup')).toBe('weak');
  });
});
