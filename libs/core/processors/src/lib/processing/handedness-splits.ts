import type { BatHand, PitcherTrackedPlay } from '@ws/core/models';

/** NEWMAC conference teams */
const NEWMAC_TEAMS = [
  'babson',
  'clark',
  'coast guard',
  'emerson',
  'mit',
  'mount holyoke',
  'smith',
  'springfield',
  'wellesley',
  'wheaton',
  'wpi',
  'uscga',
];

export interface HandednessSplitStats {
  hand: BatHand;
  pa: number;
  ab: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  walks: number;
  strikeouts: number;
  hbp: number;
}

/**
 * Check if an opponent name looks like a NEWMAC conference game.
 */
export function isConferenceGame(opponentName: string): boolean {
  const lower = opponentName.toLowerCase();

  return NEWMAC_TEAMS.some((team) => lower.includes(team));
}

/**
 * Compute batting splits by handedness for a pitcher's tracked plays.
 *
 * @param plays - Tracked plays to analyze
 * @param handednessMap - Map of normalized batter name → bat hand
 * @param conferenceOnly - If true, only include plays from conference games
 * @param gameOpponents - Map of play index ranges to opponent names (for conference filtering)
 */
export function computeHandednessSplits(
  plays: PitcherTrackedPlay[],
  handednessMap: Map<string, BatHand>
): Map<BatHand, HandednessSplitStats> {
  const splits = new Map<BatHand, HandednessSplitStats>();

  const getOrCreate = (hand: BatHand): HandednessSplitStats => {
    if (!splits.has(hand)) {
      splits.set(hand, {
        hand,
        pa: 0,
        ab: 0,
        hits: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        walks: 0,
        strikeouts: 0,
        hbp: 0,
      });
    }

    return splits.get(hand) as HandednessSplitStats;
  };

  plays
    .filter((p) => p.isPlateAppearance && p.batterName)
    .forEach((play) => {
      const normalizedName = (play.batterName ?? '')
        .replace(/\./g, '')
        .trim()
        .toLowerCase();
      const hand = handednessMap.get(normalizedName);

      if (!hand) {
        return;
      }

      const stats = getOrCreate(hand);
      stats.pa += 1;

      switch (play.batterResult) {
        case 'single':
        case 'bunt_single':
          stats.hits += 1;
          stats.singles += 1;
          stats.ab += 1;
          break;
        case 'double':
          stats.hits += 1;
          stats.doubles += 1;
          stats.ab += 1;
          break;
        case 'triple':
          stats.hits += 1;
          stats.triples += 1;
          stats.ab += 1;
          break;
        case 'homer':
          stats.hits += 1;
          stats.hr += 1;
          stats.ab += 1;
          break;
        case 'walk':
          stats.walks += 1;
          break;
        case 'hbp':
          stats.hbp += 1;
          break;
        case 'out':
        case 'double_play':
        case 'reached':
        case 'unknown':
          stats.ab += 1;
          break;
        case 'sac_bunt':
        case 'sac_fly':
          // Not an AB
          break;
      }

      if (
        play.batterResult === 'out' &&
        play.playText.toLowerCase().includes('struck out')
      ) {
        stats.strikeouts += 1;
      }
    });

  return splits;
}

/** Convert handedness split stats to batting average */
export function splitBattingAvg(stats: HandednessSplitStats): number {
  if (stats.ab === 0) {
    return 0;
  }

  return stats.hits / stats.ab;
}
