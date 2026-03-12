import type { SprayDataPoint, SprayTrend } from '@ws/core/models';

import { getContactQuality } from './spray-chart';
import { CENTER_ZONES, LEFT_ZONES, RIGHT_ZONES } from './spray-zone-groups';

const MIN_CONTACTS = 10;
const SHIFT_THRESHOLD = 15;

function zonePct(data: SprayDataPoint[], zones: Set<string>): number {
  if (data.length === 0) {
    return 0;
  }

  const count = data.filter((d) => zones.has(d.zone)).length;

  return (count / data.length) * 100;
}

function qualityPct(data: SprayDataPoint[], quality: 'hard' | 'weak'): number {
  if (data.length === 0) {
    return 0;
  }

  const count = data.filter((d) => getContactQuality(d.contactType) === quality).length;

  return (count / data.length) * 100;
}

export function detectSprayTrends(thisYearData: SprayDataPoint[], lastYearData: SprayDataPoint[], minContacts = MIN_CONTACTS): SprayTrend[] {
  if (thisYearData.length < minContacts || lastYearData.length < minContacts) {
    return [];
  }

  const trends: SprayTrend[] = [];

  // L/C/R shifts
  const thisLeft = zonePct(thisYearData, LEFT_ZONES);
  const lastLeft = zonePct(lastYearData, LEFT_ZONES);
  const leftDelta = thisLeft - lastLeft;

  if (Math.abs(leftDelta) >= SHIFT_THRESHOLD) {
    trends.push({
      type: 'pull_shift',
      label: `Pull ${Math.round(lastLeft)}→${Math.round(thisLeft)}%`,
      direction: leftDelta > 0 ? 'up' : 'down',
      magnitude: Math.abs(leftDelta),
    });
  }

  const thisCenter = zonePct(thisYearData, CENTER_ZONES);
  const lastCenter = zonePct(lastYearData, CENTER_ZONES);
  const centerDelta = thisCenter - lastCenter;

  if (Math.abs(centerDelta) >= SHIFT_THRESHOLD) {
    trends.push({
      type: 'center_shift',
      label: `Center ${Math.round(lastCenter)}→${Math.round(thisCenter)}%`,
      direction: centerDelta > 0 ? 'up' : 'down',
      magnitude: Math.abs(centerDelta),
    });
  }

  const thisRight = zonePct(thisYearData, RIGHT_ZONES);
  const lastRight = zonePct(lastYearData, RIGHT_ZONES);
  const rightDelta = thisRight - lastRight;

  if (Math.abs(rightDelta) >= SHIFT_THRESHOLD) {
    trends.push({
      type: 'oppo_shift',
      label: `Oppo ${Math.round(lastRight)}→${Math.round(thisRight)}%`,
      direction: rightDelta > 0 ? 'up' : 'down',
      magnitude: Math.abs(rightDelta),
    });
  }

  // Contact quality shifts
  const thisHard = qualityPct(thisYearData, 'hard');
  const lastHard = qualityPct(lastYearData, 'hard');
  const hardDelta = thisHard - lastHard;

  if (Math.abs(hardDelta) >= SHIFT_THRESHOLD) {
    trends.push({
      type: 'more_hard',
      label: `Hard ${Math.round(lastHard)}→${Math.round(thisHard)}%`,
      direction: hardDelta > 0 ? 'up' : 'down',
      magnitude: Math.abs(hardDelta),
    });
  }

  const thisWeak = qualityPct(thisYearData, 'weak');
  const lastWeak = qualityPct(lastYearData, 'weak');
  const weakDelta = thisWeak - lastWeak;

  if (Math.abs(weakDelta) >= SHIFT_THRESHOLD) {
    trends.push({
      type: 'more_weak',
      label: `Weak ${Math.round(lastWeak)}→${Math.round(thisWeak)}%`,
      direction: weakDelta > 0 ? 'up' : 'down',
      magnitude: Math.abs(weakDelta),
    });
  }

  return trends;
}
