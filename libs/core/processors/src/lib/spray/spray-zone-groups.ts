import type { SprayZone } from '@ws/core/models';

export const LEFT_ZONES: Set<SprayZone> = new Set(['lf_line', 'lf', 'lf_cf', 'if_3b', 'if_ss', 'plate_3b']);

export const CENTER_ZONES: Set<SprayZone> = new Set(['cf', 'if_p', 'plate_p']);

export const RIGHT_ZONES: Set<SprayZone> = new Set(['rf_cf', 'rf', 'rf_line', 'if_1b', 'if_2b', 'plate_1b']);
