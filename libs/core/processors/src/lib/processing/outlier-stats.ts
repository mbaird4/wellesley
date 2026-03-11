import type { BaseRunnerRow, BaseSituation } from '@ws/core/models';

export type OutlierMap = Record<string, number>;

type OutIndex = 0 | 1 | 2 | 'total';

const MIN_COLUMN_SUM = 9;

const SITUATIONS: BaseSituation[] = ['empty', 'first', 'second', 'third', 'first_second', 'first_third', 'second_third', 'loaded'];

const OUT_INDICES: OutIndex[] = [0, 1, 2, 'total'];

function getColumnValue(row: BaseRunnerRow, situation: BaseSituation, outIndex: OutIndex): number {
  const breakdown = row.situations[situation];

  if (outIndex === 'total') {
    return breakdown[0] + breakdown[1] + breakdown[2];
  }

  return breakdown[outIndex];
}

/**
 * Computes deviation scores for each cell as (value - mean) / (max - min).
 * Result ranges from roughly -1 to 1. Columns with no variance or < 5 total PAs are skipped.
 */
export function computeOutlierMap(rows: BaseRunnerRow[]): OutlierMap {
  const result: OutlierMap = {};

  if (rows.length === 0) {
    return result;
  }

  SITUATIONS.forEach((situation) => {
    OUT_INDICES.forEach((outIndex) => {
      const values = rows.map((row) => getColumnValue(row, situation, outIndex));
      const columnSum = values.reduce((sum, v) => sum + v, 0);

      if (columnSum < MIN_COLUMN_SUM) {
        return;
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      if (range === 0) {
        return;
      }

      const mean = columnSum / values.length;

      rows.forEach((row) => {
        const value = getColumnValue(row, situation, outIndex);
        const deviation = (value - mean) / range;
        result[`${row.lineupSlot}-${situation}-${outIndex}`] = deviation;
      });
    });
  });

  return result;
}
