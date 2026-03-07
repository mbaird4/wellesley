import type { StatFormat } from '@ws/core/ui';

export interface StatColumn {
  key: string;
  label: string;
  format: StatFormat;
  dashPairKeys?: [string, string];
}

export const HITTING_COLUMNS: StatColumn[] = [
  { key: 'avg', label: 'AVG', format: 'avg' },
  { key: 'ops', label: 'OPS', format: 'avg' },
  { key: 'gp-gs', label: 'GP-GS', format: 'int', dashPairKeys: ['gp', 'gs'] },
  { key: 'ab', label: 'AB', format: 'int' },
  { key: 'r', label: 'R', format: 'int' },
  { key: 'h', label: 'H', format: 'int' },
  { key: 'doubles', label: '2B', format: 'int' },
  { key: 'triples', label: '3B', format: 'int' },
  { key: 'hr', label: 'HR', format: 'int' },
  { key: 'rbi', label: 'RBI', format: 'int' },
  { key: 'tb', label: 'TB', format: 'int' },
  { key: 'slg', label: 'SLG%', format: 'avg' },
  { key: 'bb', label: 'BB', format: 'int' },
  { key: 'hbp', label: 'HBP', format: 'int' },
  { key: 'so', label: 'SO', format: 'int' },
  { key: 'gdp', label: 'GDP', format: 'int' },
  { key: 'obp', label: 'OB%', format: 'avg' },
  { key: 'sf', label: 'SF', format: 'int' },
  { key: 'sh', label: 'SH', format: 'int' },
  {
    key: 'sb-sbAtt',
    label: 'SB-ATT',
    format: 'int',
    dashPairKeys: ['sb', 'sbAtt'],
  },
];

export const PITCHING_COLUMNS: StatColumn[] = [
  { key: 'era', label: 'ERA', format: 'era' },
  { key: 'whip', label: 'WHIP', format: 'era' },
  { key: 'w-l', label: 'W-L', format: 'int', dashPairKeys: ['w', 'l'] },
  {
    key: 'app-gs',
    label: 'APP-GS',
    format: 'int',
    dashPairKeys: ['app', 'gs'],
  },
  { key: 'cg', label: 'CG', format: 'int' },
  { key: 'sho', label: 'SHO', format: 'int' },
  { key: 'sv', label: 'SV', format: 'int' },
  { key: 'ip', label: 'IP', format: 'ip' },
  { key: 'h', label: 'H', format: 'int' },
  { key: 'r', label: 'R', format: 'int' },
  { key: 'er', label: 'ER', format: 'int' },
  { key: 'bb', label: 'BB', format: 'int' },
  { key: 'so', label: 'SO', format: 'int' },
  { key: 'doubles', label: '2B', format: 'int' },
  { key: 'triples', label: '3B', format: 'int' },
  { key: 'hr', label: 'HR', format: 'int' },
  { key: 'ab', label: 'AB', format: 'int' },
  { key: 'bAvg', label: 'B/AVG', format: 'avg' },
  { key: 'wp', label: 'WP', format: 'int' },
  { key: 'hbp', label: 'HBP', format: 'int' },
  { key: 'bk', label: 'BK', format: 'int' },
  { key: 'sfa', label: 'SFA', format: 'int' },
  { key: 'sha', label: 'SHA', format: 'int' },
];

export const FIELDING_COLUMNS: StatColumn[] = [
  { key: 'tc', label: 'TC', format: 'int' },
  { key: 'po', label: 'PO', format: 'int' },
  { key: 'a', label: 'A', format: 'int' },
  { key: 'e', label: 'E', format: 'int' },
  { key: 'fldPct', label: 'FLD%', format: 'avg' },
  { key: 'dp', label: 'DP', format: 'int' },
  { key: 'sba', label: 'SBA', format: 'int' },
  { key: 'csb', label: 'CSB', format: 'int' },
  { key: 'pb', label: 'PB', format: 'int' },
  { key: 'ci', label: 'CI', format: 'int' },
];
