import type { PlaySnapshot } from '../models';
import { type BatterResult, parseBatterAction } from '../parsing/parse-play';
import type {
  ContactQuality,
  ContactType,
  SprayChartSummary,
  SprayDataPoint,
  SprayFilters,
  SprayOutcome,
  SprayZone,
  ZoneAggregate,
} from './spray.models';

// --- Direction → Zone mapping ---

interface DirectionMapping {
  pattern: RegExp;
  zone: SprayZone;
  angle: number;
  isInfield: boolean;
}

// Order matters: more specific patterns must come before general ones
const DIRECTION_MAPPINGS: DirectionMapping[] = [
  // Outfield — line/gap directions (check before general field areas)
  {
    pattern: /down the rf line|to right field line/i,
    zone: 'rf_line',
    angle: 10,
    isInfield: false,
  },
  {
    pattern: /down the lf line|to left field line/i,
    zone: 'lf_line',
    angle: 170,
    isInfield: false,
  },
  {
    pattern: /to right center|to rc\b/i,
    zone: 'rf_cf',
    angle: 55,
    isInfield: false,
  },
  {
    pattern: /to left center|to lc\b/i,
    zone: 'lf_cf',
    angle: 125,
    isInfield: false,
  },
  {
    pattern: /through the right side/i,
    zone: 'rf_cf',
    angle: 50,
    isInfield: false,
  },
  {
    pattern: /through the left side/i,
    zone: 'lf_cf',
    angle: 130,
    isInfield: false,
  },
  { pattern: /up the middle/i, zone: 'cf', angle: 90, isInfield: false },

  // Outfield — general field areas
  {
    pattern: /to right field\b|to rf\b/i,
    zone: 'rf',
    angle: 30,
    isInfield: false,
  },
  {
    pattern: /to center field\b|to cf\b/i,
    zone: 'cf',
    angle: 90,
    isInfield: false,
  },
  {
    pattern: /to left field\b|to lf\b/i,
    zone: 'lf',
    angle: 150,
    isInfield: false,
  },

  // Infield positions
  {
    pattern: /to third base|to 3b\b/i,
    zone: 'if_3b',
    angle: 155,
    isInfield: true,
  },
  {
    pattern: /to shortstop|to ss\b/i,
    zone: 'if_ss',
    angle: 120,
    isInfield: true,
  },
  {
    pattern: /to second base|to 2b\b/i,
    zone: 'if_2b',
    angle: 75,
    isInfield: true,
  },
  {
    pattern: /to first base|to 1b\b/i,
    zone: 'if_1b',
    angle: 30,
    isInfield: true,
  },
  {
    pattern: /to pitcher\b|to p\b|back to the pitcher/i,
    zone: 'if_p',
    angle: 90,
    isInfield: true,
  },
  { pattern: /to catcher\b|to c\b/i, zone: 'if_c', angle: 90, isInfield: true },
];

// --- Contact type classification ---

export function classifyContactType(playText: string): ContactType {
  const lower = playText.toLowerCase();

  if (/\bbunt(ed)?\b/i.test(lower)) {
    return 'bunt';
  }

  if (/\bpopped\b|\bpopup\b|\bpop\s+up\b|\binfield fly\b/i.test(lower)) {
    return 'popup';
  }

  if (/\blined\b|\bline\s+drive\b/i.test(lower)) {
    return 'line_out';
  }

  if (/\bflied\b|\bfly\s+ball\b|\bflyout\b|\bfouled\s+out\b/i.test(lower)) {
    return 'popup';
  }

  if (/\bgrounded\b|\bground\s+ball\b|\bgroundout\b/i.test(lower)) {
    return 'ground_ball';
  }

  // "out at first" without explicit contact verb — infer from fielder position
  if (/\bout at first\s+(p|c|1b|2b|3b|ss)\b/i.test(lower)) {
    return 'bunt';
  }

  if (/\bout at first\s+(lf|cf|rf)\b/i.test(lower)) {
    return 'popup';
  }

  return 'unknown';
}

// --- Contact quality ---

export function getContactQuality(contactType: ContactType): ContactQuality {
  if (
    contactType === 'hit' ||
    contactType === 'line_out' ||
    contactType === 'bunt'
  ) {
    return 'hard';
  }

  return 'weak';
}

// --- Direction parsing ---

export function parseSprayDirection(playText: string): {
  zone: SprayZone;
  angle: number;
  isInfield: boolean;
  direction: string;
} | null {
  // Extract the batter action (first sub-event before semicolons)
  const batterAction = playText.split(';')[0];

  const match = DIRECTION_MAPPINGS.find((m) => m.pattern.test(batterAction));

  if (!match) {
    return null;
  }

  // Extract the matched direction text for the raw "direction" field
  const dirMatch = batterAction.match(match.pattern);
  const direction = dirMatch ? dirMatch[0] : '';

  return {
    zone: match.zone,
    angle: match.angle,
    isInfield: match.isInfield,
    direction,
  };
}

// --- Bunt zone parsing ---

/** Maps a fielder position to a plate bunt zone */
const FIELDER_TO_PLATE_ZONE: Record<
  string,
  { zone: SprayZone; angle: number }
> = {
  '3b': { zone: 'plate_3b', angle: 150 },
  ss: { zone: 'plate_3b', angle: 150 },
  p: { zone: 'plate_p', angle: 90 },
  c: { zone: 'plate_p', angle: 90 },
  '1b': { zone: 'plate_1b', angle: 30 },
  '2b': { zone: 'plate_1b', angle: 30 },
};

/**
 * For bunt plays, extracts the fielder who fielded the ball and maps
 * to a plate zone (plate_3b, plate_p, plate_1b).
 *
 * Special case: "out at first XX to YY" — XX is the fielder, YY covered first.
 * Normal case: "grounded out to XX" — XX is the fielder.
 */
export function parseBuntZone(playText: string): {
  zone: SprayZone;
  angle: number;
  direction: string;
} | null {
  const batterAction = playText.split(';')[0];

  // "out at first XX to YY" — XX is the fielder, not YY
  const outAtFirstMatch = batterAction.match(
    /\bout at first\s+(p|c|1b|2b|3b|ss)\b/i
  );

  if (outAtFirstMatch) {
    const fielder = outAtFirstMatch[1].toLowerCase();
    const mapping = FIELDER_TO_PLATE_ZONE[fielder];

    if (mapping) {
      return {
        zone: mapping.zone,
        angle: mapping.angle,
        direction: `fielded by ${fielder}`,
      };
    }
  }

  // Normal bunt plays — use standard direction parsing, then remap to plate zone
  const direction = parseSprayDirection(playText);

  if (!direction) {
    // Bunts with no direction (e.g., "singled, bunt") default to plate_p
    return { zone: 'plate_p', angle: 90, direction: 'bunt' };
  }

  // Extract fielder position from the zone (e.g., if_3b → 3b, if_p → p)
  const fielderMatch = direction.zone.match(/^if_(.+)$/);

  if (fielderMatch) {
    const fielder = fielderMatch[1];
    const mapping = FIELDER_TO_PLATE_ZONE[fielder];

    if (mapping) {
      return {
        zone: mapping.zone,
        angle: mapping.angle,
        direction: direction.direction,
      };
    }
  }

  // Fallback to plate_p for any bunt with unrecognized zone
  return { zone: 'plate_p', angle: 90, direction: direction.direction };
}

// --- Outcome classification ---

/** Results that represent ball-in-play contact with meaningful direction */
const CONTACT_RESULTS: BatterResult[] = [
  'out',
  'double_play',
  'single',
  'bunt_single',
  'double',
  'triple',
  'homer',
  'sac_bunt',
  'sac_fly',
];

const HIT_RESULTS: BatterResult[] = ['single', 'double', 'triple', 'homer'];

function classifyOutcome(result: BatterResult): SprayOutcome {
  if (HIT_RESULTS.includes(result) || result === 'bunt_single') {
    return 'hit';
  }

  if (result === 'reached') {
    return 'error';
  }

  return 'out';
}

function classifyHitType(result: BatterResult): string {
  switch (result) {
    case 'single':
    case 'bunt_single':
      return 'single';
    case 'double':
      return 'double';
    case 'triple':
      return 'triple';
    case 'homer':
      return 'homer';
    case 'reached':
      return 'error';
    default:
      return 'out';
  }
}

// --- Main parsing function ---

/**
 * Extracts spray data from play snapshots.
 * Uses parseBatterAction from the core parse-play pipeline to classify
 * batter results, then filters to contact plays with directional info.
 */
export function parseSprayData(
  snapshots: PlaySnapshot[],
  gameIndex: number
): SprayDataPoint[] {
  return snapshots
    .filter((snap) => snap.isPlateAppearance && snap.batterName)
    .map((snap): SprayDataPoint | null => {
      const batterAction = snap.playText.split(';')[0].trim();

      // Strikeouts aren't batted balls (including dropped 3rd strikes)
      if (/\bstruck out\b/i.test(batterAction)) {
        return null;
      }

      const { result } = parseBatterAction(batterAction);

      // Skip non-contact events (walks, HBP, unknown)
      if (!CONTACT_RESULTS.includes(result)) {
        return null;
      }

      const baseContactType = classifyContactType(snap.playText);
      // Hits don't have contact info in the play text (just "singled to cf"),
      // so classify them as 'hit' — unless it's a bunt for a hit.
      const contactType =
        HIT_RESULTS.includes(result) && baseContactType !== 'bunt'
          ? 'hit'
          : baseContactType;

      const situational = {
        outsBefore: snap.outsBefore,
        runnersOnBase: !!(
          snap.basesBefore.first ||
          snap.basesBefore.second ||
          snap.basesBefore.third
        ),
        risp: !!(snap.basesBefore.second || snap.basesBefore.third),
      };

      // For bunts, use plate zone parsing (fielder-based, not throw destination)
      if (contactType === 'bunt') {
        const buntDir = parseBuntZone(snap.playText);

        return {
          playerName: snap.batterName!,
          zone: buntDir!.zone,
          contactType,
          outcome: classifyOutcome(result),
          hitType: classifyHitType(result),
          direction: buntDir!.direction,
          angle: buntDir!.angle,
          isInfield: true,
          playText: snap.playText,
          gameIndex,
          inning: snap.inning,
          ...situational,
        } satisfies SprayDataPoint;
      }

      // Non-bunt plays require directional info
      const direction = parseSprayDirection(snap.playText);

      if (!direction) {
        return null;
      }

      return {
        playerName: snap.batterName!,
        zone: direction.zone,
        contactType,
        outcome: classifyOutcome(result),
        hitType: classifyHitType(result),
        direction: direction.direction,
        angle: direction.angle,
        isInfield: direction.isInfield,
        playText: snap.playText,
        gameIndex,
        inning: snap.inning,
        ...situational,
      } satisfies SprayDataPoint;
    })
    .filter((point): point is SprayDataPoint => point !== null);
}

// --- Zone aggregation ---

const ALL_ZONES: SprayZone[] = [
  'lf_line',
  'lf',
  'lf_cf',
  'cf',
  'rf_cf',
  'rf',
  'rf_line',
  'if_3b',
  'if_ss',
  'if_2b',
  'if_1b',
  'if_p',
  'if_c',
  'plate_3b',
  'plate_p',
  'plate_1b',
];

/**
 * Aggregates spray data points into zone-level statistics.
 * Optionally filters by player, outcome, and contact type.
 */
export function computeSprayZones(
  dataPoints: SprayDataPoint[],
  filters?: SprayFilters
): SprayChartSummary {
  let filtered = dataPoints;

  if (filters?.playerName) {
    filtered = filtered.filter((p) => p.playerName === filters.playerName);
  }

  if (filters?.outcomes) {
    filtered = filtered.filter((p) => filters.outcomes!.includes(p.outcome));
  }

  if (filters?.contactTypes) {
    filtered = filtered.filter((p) =>
      filters.contactTypes!.includes(p.contactType)
    );
  }

  if (filters?.contactQualities) {
    filtered = filtered.filter((p) =>
      filters.contactQualities!.includes(getContactQuality(p.contactType))
    );
  }

  if (filters?.outCount) {
    filtered = filtered.filter((p) => filters.outCount!.includes(p.outsBefore));
  }

  if (filters?.risp === true) {
    filtered = filtered.filter((p) => p.risp);
  }

  const totalContact = filtered.length;

  const zones: ZoneAggregate[] = ALL_ZONES.map((zone) => {
    const zonePoints = filtered.filter((p) => p.zone === zone);
    const hits = zonePoints.filter((p) => p.outcome === 'hit').length;
    const outs = zonePoints.filter((p) => p.outcome === 'out').length;
    const errors = zonePoints.filter((p) => p.outcome === 'error').length;
    const total = zonePoints.length;

    return {
      zone,
      total,
      hits,
      outs,
      errors,
      pct: totalContact > 0 ? total / totalContact : 0,
      battingAvg: hits + outs > 0 ? hits / (hits + outs) : 0,
    };
  });

  return {
    playerName: filters?.playerName ?? null,
    dataPoints: filtered,
    zones,
    totalContact,
  };
}
