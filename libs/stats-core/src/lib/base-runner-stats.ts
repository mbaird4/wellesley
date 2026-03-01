import type {
  BaseRunnerRow,
  BaseRunners,
  BaseSituation,
  OutBreakdown,
  PlaySnapshot,
} from './types';

const ALL_SITUATIONS: BaseSituation[] = [
  'empty',
  'first',
  'second',
  'third',
  'first_second',
  'first_third',
  'second_third',
  'loaded',
];

function emptyRow(slot: number): BaseRunnerRow {
  const situations = Object.fromEntries(
    ALL_SITUATIONS.map((s) => [s, [0, 0, 0] as OutBreakdown])
  ) as Record<BaseSituation, OutBreakdown>;

  return { lineupSlot: slot, situations };
}

export function classifyBaseSituation(bases: BaseRunners): BaseSituation {
  const f = bases.first !== null;
  const s = bases.second !== null;
  const t = bases.third !== null;

  if (!f && !s && !t) {
    return 'empty';
  }

  if (f && !s && !t) {
    return 'first';
  }

  if (!f && s && !t) {
    return 'second';
  }

  if (!f && !s && t) {
    return 'third';
  }

  if (f && s && !t) {
    return 'first_second';
  }

  if (f && !s && t) {
    return 'first_third';
  }

  if (!f && s && t) {
    return 'second_third';
  }

  return 'loaded';
}

export function computeBaseRunnerStats(
  snapshots: PlaySnapshot[]
): BaseRunnerRow[] {
  const rows = new Map<number, BaseRunnerRow>();

  snapshots
    .filter((snap) => snap.isPlateAppearance && snap.lineupSlot !== null)
    .forEach((snap) => {
      const slot = snap.lineupSlot!;

      if (!rows.has(slot)) {
        rows.set(slot, emptyRow(slot));
      }

      const row = rows.get(slot)!;
      const situation = classifyBaseSituation(snap.basesBefore);
      const outs = snap.outsBefore as 0 | 1 | 2;
      row.situations[situation][outs]++;
    });

  // Ensure all 9 slots exist
  Array.from({ length: 9 }, (_, i) => i + 1).forEach((s) => {
    if (!rows.has(s)) {
      rows.set(s, emptyRow(s));
    }
  });

  return Array.from(rows.values()).sort((a, b) => a.lineupSlot - b.lineupSlot);
}

export function mergeBaseRunnerStats(
  a: BaseRunnerRow[],
  b: BaseRunnerRow[]
): BaseRunnerRow[] {
  const map = new Map<number, BaseRunnerRow>();

  a.forEach((row) => {
    map.set(row.lineupSlot, {
      lineupSlot: row.lineupSlot,
      situations: {
        ...Object.fromEntries(
          ALL_SITUATIONS.map((s) => [s, [...row.situations[s]] as OutBreakdown])
        ),
      } as Record<BaseSituation, OutBreakdown>,
    });
  });

  b.forEach((row) => {
    if (!map.has(row.lineupSlot)) {
      map.set(row.lineupSlot, emptyRow(row.lineupSlot));
    }

    const target = map.get(row.lineupSlot)!;
    ALL_SITUATIONS.forEach((s) => {
      target.situations[s][0] += row.situations[s][0];
      target.situations[s][1] += row.situations[s][1];
      target.situations[s][2] += row.situations[s][2];
    });
  });

  // Ensure all 9 slots
  Array.from({ length: 9 }, (_, i) => i + 1).forEach((s) => {
    if (!map.has(s)) {
      map.set(s, emptyRow(s));
    }
  });

  return Array.from(map.values()).sort((a, b) => a.lineupSlot - b.lineupSlot);
}
