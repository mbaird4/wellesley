export const CURRENT_YEAR = new Date().getFullYear();

/** 4-year rolling window — pitching, spray charts, opponents */
export const RECENT_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

/** All seasons with Wellesley data. 2020–2021 excluded (COVID, no season). */
const NO_SEASON_YEARS = new Set([2020, 2021]);
export const ALL_SEASON_YEARS = Array.from({ length: CURRENT_YEAR - 2011 + 1 }, (_, i) => CURRENT_YEAR - i).filter((y) => !NO_SEASON_YEARS.has(y));
