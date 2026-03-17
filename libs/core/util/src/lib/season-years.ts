export const CURRENT_YEAR = new Date().getFullYear();

/** 4-year rolling window — pitching, spray charts, opponents, wOBA, clutch, etc. */
export const RECENT_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

/** Season year selector — 4-year rolling window, excluding COVID gap. */
const NO_SEASON_YEARS = new Set([2020, 2021]);
export const ALL_SEASON_YEARS = RECENT_YEARS.filter((y) => !NO_SEASON_YEARS.has(y));
