import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { SprayZone, ZoneAggregate } from '@ws/stats-core';

export interface ZoneTooltipData {
  path: string;
  cx: number;
  cy: number;
  fill: string;
  scaleTransform: string;
  tooltipX: number;
  tooltipY: number;
  label: string;
  total: number;
  hits: number;
  outs: number;
  avg: string;
  pct: string;
}

interface ZonePathData {
  zone: SprayZone;
  path: string;
  labelX: number;
  labelY: number;
}

// Home plate at center-bottom. Field fans out upward.
// Angles: 0° = RF foul line (right side), 90° = CF (top), 180° = LF foul line (left side).
// Standard baseball view from behind home plate: RF on right, LF on left.

const HOME_X = 350;
const HOME_Y = 460;
const OF_RADIUS = 340;
const IF_RADIUS = 140;
const PLATE_RADIUS = 50;

// Cone boundaries — narrower than 180° for realistic field shape
const FOUL_RF = 45;
const FOUL_LF = 135;
const FIELD_SPAN = FOUL_LF - FOUL_RF; // 144°

// ── Zone proportions ────────────────────────────────────────────────
// Each array defines zone widths as % of the 144° field span.
// Each row must sum to 100. To resize zones, only edit these arrays.
//
//                       RF Line  RF    RF-CF  CF    LF-CF  LF    LF Line
const OF_W = [  3,     17,    12,   36,    12,   17,    3     ];
//              1B      2B     P     SS     3B
const IF_W = [  17,     25,    16,   25,    17    ];
//              1B      P      3B
const PL_W = [  38,     24,    38    ];

/** Convert an array of zone width %s into boundary angles between zones. */
function toBounds(widths: number[]): number[] {
  const bounds: number[] = [FOUL_RF];
  let cum = 0;

  widths.forEach((w) => {
    cum += w;
    bounds.push(FOUL_RF + (cum / 100) * FIELD_SPAN);
  });

  return bounds;
}

const OF_B = toBounds(OF_W);
const IF_B = toBounds(IF_W);
const PL_B = toBounds(PL_W);

function polarToXY(angleDeg: number, radius: number): [number, number] {
  // 0° = right (RF), 90° = up (CF), 180° = left (LF)
  const svgAngle = -angleDeg * (Math.PI / 180);
  const x = HOME_X + radius * Math.cos(svgAngle);
  const y = HOME_Y + radius * Math.sin(svgAngle);

  return [x, y];
}

/**
 * Outfield sector: curved arc at OF_RADIUS, straight chord at IF_RADIUS.
 * The only curve in the entire field is this outer arc.
 */
function ofSectorPath(startAngle: number, endAngle: number): string {
  const [ox1, oy1] = polarToXY(startAngle, OF_RADIUS);
  const [ox2, oy2] = polarToXY(endAngle, OF_RADIUS);
  const [ix2, iy2] = polarToXY(endAngle, IF_RADIUS);
  const [ix1, iy1] = polarToXY(startAngle, IF_RADIUS);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${ix1} ${iy1}`,
    `L ${ox1} ${oy1}`,
    `A ${OF_RADIUS} ${OF_RADIUS} 0 ${largeArc} 0 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    'Z', // straight chord back — no inner arc
  ].join(' ');
}

/** Infield sector: curved arc at IF_RADIUS, straight chord at PLATE_RADIUS. */
function ifSectorPath(startAngle: number, endAngle: number): string {
  const [ox1, oy1] = polarToXY(startAngle, IF_RADIUS);
  const [ox2, oy2] = polarToXY(endAngle, IF_RADIUS);
  const [ix2, iy2] = polarToXY(endAngle, PLATE_RADIUS);
  const [ix1, iy1] = polarToXY(startAngle, PLATE_RADIUS);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${ix1} ${iy1}`,
    `L ${ox1} ${oy1}`,
    `A ${IF_RADIUS} ${IF_RADIUS} 0 ${largeArc} 0 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    'Z',
  ].join(' ');
}

/** Pie-slice wedge from home plate to an outer arc */
function wedgePath(startAngle: number, endAngle: number, radius: number): string {
  const [x1, y1] = polarToXY(startAngle, radius);
  const [x2, y2] = polarToXY(endAngle, radius);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${HOME_X} ${HOME_Y}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`,
    'Z',
  ].join(' ');
}

function zoneMidpoint(
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number
): [number, number] {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;

  return polarToXY(midAngle, midRadius);
}

// --- Zone definitions (non-overlapping ring segments) ---

function makeOfZone(start: number, end: number): Omit<ZonePathData, 'zone'> {
  const [lx, ly] = zoneMidpoint(start, end, IF_RADIUS, OF_RADIUS);

  return { path: ofSectorPath(start, end), labelX: lx, labelY: ly };
}

function makeIfZone(start: number, end: number): Omit<ZonePathData, 'zone'> {
  const [lx, ly] = zoneMidpoint(start, end, PLATE_RADIUS, IF_RADIUS);

  return { path: ifSectorPath(start, end), labelX: lx, labelY: ly };
}

function makePlateZone(start: number, end: number): Omit<ZonePathData, 'zone'> {
  const midAngle = (start + end) / 2;
  const [lx, ly] = polarToXY(midAngle, PLATE_RADIUS * 0.7);

  return { path: wedgePath(start, end, PLATE_RADIUS), labelX: lx, labelY: ly };
}

const OF_ZONE_IDS: SprayZone[] = ['rf_line', 'rf', 'rf_cf', 'cf', 'lf_cf', 'lf', 'lf_line'];
const IF_ZONE_IDS: SprayZone[] = ['if_1b', 'if_2b', 'if_p', 'if_ss', 'if_3b'];
const PL_ZONE_IDS: SprayZone[] = ['plate_1b', 'plate_p', 'plate_3b'];

const OF_ZONES: ZonePathData[] = OF_ZONE_IDS.map((zone, i) => ({
  zone,
  ...makeOfZone(OF_B[i], OF_B[i + 1]),
}));

const IF_ZONES: ZonePathData[] = IF_ZONE_IDS.map((zone, i) => ({
  zone,
  ...makeIfZone(IF_B[i], IF_B[i + 1]),
}));

const PLATE_ZONES: ZonePathData[] = PL_ZONE_IDS.map((zone, i) => ({
  zone,
  ...makePlateZone(PL_B[i], PL_B[i + 1]),
}));

// --- Decorative lines ---

function makeFieldArc(): string {
  const [x1, y1] = polarToXY(FOUL_RF, OF_RADIUS);
  const [x2, y2] = polarToXY(FOUL_LF, OF_RADIUS);

  return `M ${x1} ${y1} A ${OF_RADIUS} ${OF_RADIUS} 0 0 0 ${x2} ${y2}`;
}

function makeFoulLine(angle: number): string {
  const [x, y] = polarToXY(angle, OF_RADIUS + 10);

  return `M ${HOME_X} ${HOME_Y} L ${x} ${y}`;
}

function makeDivider(angle: number, innerR: number, outerR: number): string {
  const [x1, y1] = innerR === 0 ? [HOME_X, HOME_Y] : polarToXY(angle, innerR);
  const [x2, y2] = polarToXY(angle, outerR);

  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

const FIELD_OUTLINE = makeFieldArc();
const FOUL_LINE_RF_PATH = makeFoulLine(FOUL_RF);
const FOUL_LINE_LF_PATH = makeFoulLine(FOUL_LF);

// Radial dividers — auto-derived from zone boundaries, one per ring
const DIVIDERS: string[] = [
  ...OF_B.slice(1, -1).map((a) => makeDivider(a, IF_RADIUS, OF_RADIUS)),
  ...IF_B.slice(1, -1).map((a) => makeDivider(a, PLATE_RADIUS, IF_RADIUS)),
  ...PL_B.slice(1, -1).map((a) => makeDivider(a, 0, PLATE_RADIUS)),
];

const ALL_ZONE_PATHS: ZonePathData[] = [...OF_ZONES, ...IF_ZONES, ...PLATE_ZONES];
const ZONE_PATH_MAP = new Map<SprayZone, ZonePathData>(ALL_ZONE_PATHS.map((z) => [z.zone, z]));

const ZONE_LABEL_MAP: Record<SprayZone, string> = {
  rf_line: 'RF Line',
  rf: 'RF',
  rf_cf: 'RF-CF',
  cf: 'CF',
  lf_cf: 'LF-CF',
  lf: 'LF',
  lf_line: 'LF Line',
  if_3b: '3B',
  if_ss: 'SS',
  if_2b: '2B',
  if_1b: '1B',
  if_p: 'P',
  if_c: 'C',
  plate_3b: '3B',
  plate_p: 'P',
  plate_1b: '1B',
};

const ZONE_ANCHOR: Partial<Record<SprayZone, string>> = {
  rf_line: 'end',
  lf_line: 'start',
};

@Component({
  selector: 'ws-spray-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './spray-field.html',
  styleUrl: './spray-field.scss',
})
export class SprayField {
  zones = input.required<ZoneAggregate[]>();
  highlightZone = input<SprayZone | null>(null);

  zoneHover = output<SprayZone | null>();
  zoneClick = output<SprayZone>();

  readonly ofZones = OF_ZONES;
  readonly ifZones = IF_ZONES;
  readonly plateZones = PLATE_ZONES;
  readonly homeX = HOME_X;
  readonly homeY = HOME_Y;
  readonly fieldOutline = FIELD_OUTLINE;
  readonly foulLineRF = FOUL_LINE_RF_PATH;
  readonly foulLineLF = FOUL_LINE_LF_PATH;
  readonly dividers = DIVIDERS;

  readonly hoveredZone = signal<SprayZone | null>(null);

  readonly tooltipData = computed<ZoneTooltipData | null>(() => {
    const zone = this.hoveredZone();

    if (!zone) {
      return null;
    }

    const pathData = ZONE_PATH_MAP.get(zone);
    const agg = this.zoneMap().get(zone);

    if (!pathData || !agg || agg.total === 0) {
      return null;
    }

    const cx = pathData.labelX;
    const cy = pathData.labelY;

    // Position tooltip above the zone centroid
    const tooltipY = Math.max(cy - 40, 100);

    return {
      path: pathData.path,
      cx,
      cy,
      fill: this.zoneFill(zone),
      scaleTransform: `translate(${cx}, ${cy}) scale(1.08) translate(${-cx}, ${-cy})`,
      tooltipX: cx,
      tooltipY,
      label: ZONE_LABEL_MAP[zone],
      total: agg.total,
      hits: agg.hits,
      outs: agg.outs + agg.errors,
      avg: agg.battingAvg.toFixed(3).replace(/^0/, ''),
      pct: `${(agg.pct * 100).toFixed(0)}%`,
    };
  });

  readonly zoneMap = computed(() => {
    const map = new Map<SprayZone, ZoneAggregate>();
    this.zones().forEach((z) => map.set(z.zone, z));

    return map;
  });

  readonly maxValue = computed(() => {
    return Math.max(...this.zones().map((z) => z.pct), 0.01);
  });

  zoneLabel(zone: SprayZone): string {
    return ZONE_LABEL_MAP[zone];
  }

  zoneLabelAnchor(zone: SprayZone): string {
    return ZONE_ANCHOR[zone] ?? 'middle';
  }

  /** Compute the fill intensity (0-1) for a zone */
  private zoneIntensity(zone: SprayZone): number {
    const agg = this.zoneMap().get(zone);

    if (!agg || agg.total === 0) {
      return -1;
    }

    return Math.min(agg.pct / this.maxValue(), 1);
  }

  zoneFill(zone: SprayZone): string {
    const intensity = this.zoneIntensity(zone);

    if (intensity < 0) {
      return '#f5f5f0';
    }

    const s = 35 + intensity * 35;
    const l = 88 - intensity * 58;

    return `hsl(140, ${s}%, ${l}%)`;
  }

  zoneTextFill(zone: SprayZone): string {
    const intensity = this.zoneIntensity(zone);

    return intensity > 0.5 ? '#ffffff' : '#1a1a2e';
  }

  zoneLabelFill(zone: SprayZone): string {
    const intensity = this.zoneIntensity(zone);

    return intensity > 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)';
  }

  zoneCount(zone: SprayZone): string {
    const agg = this.zoneMap().get(zone);

    if (!agg || agg.total === 0) {
      return '';
    }

    return `${agg.total}`;
  }

  zoneDetail(zone: SprayZone): string {
    const agg = this.zoneMap().get(zone);

    if (!agg || agg.total === 0) {
      return '';
    }

    return `${(agg.pct * 100).toFixed(0)}%`;
  }

  isHighlighted(zone: SprayZone): boolean {
    return this.highlightZone() === zone;
  }

  onZoneHover(zone: SprayZone | null): void {
    this.hoveredZone.set(zone);
    this.zoneHover.emit(zone);
  }

  onZoneClick(zone: SprayZone): void {
    this.zoneClick.emit(zone);
  }
}
