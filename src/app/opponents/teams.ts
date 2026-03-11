import type { TeamEntry } from '@ws/core/models';

export const OPPONENT_TEAMS: TeamEntry[] = [
  { slug: 'wpi', name: 'WPI' },
  { slug: 'wheaton', name: 'Wheaton' },
  { slug: 'springfield', name: 'Springfield' },
  { slug: 'smith', name: 'Smith' },
  { slug: 'salve', name: 'Salve Regina' },
  { slug: 'mit', name: 'MIT' },
  { slug: 'emerson', name: 'Emerson' },
  { slug: 'coastguard', name: 'Coast Guard' },
  { slug: 'clark', name: 'Clark' },
  { slug: 'babson', name: 'Babson' },
].sort((a, b) => a.name.localeCompare(b.name));

export const FLORIDA_TEAMS: TeamEntry[] = [
  {
    slug: 'wesleyan',
    name: 'Wesleyan',
    group: 'florida',
    dataPath: 'florida/wesleyan',
  },
  {
    slug: 'uwrf',
    name: 'UW-River Falls',
    group: 'florida',
    dataPath: 'florida/uwrf',
  },
  {
    slug: 'brockport',
    name: 'SUNY Brockport',
    group: 'florida',
    dataPath: 'florida/brockport',
  },
  {
    slug: 'macalester',
    name: 'Macalester',
    group: 'florida',
    dataPath: 'florida/macalester',
  },
  {
    slug: 'ecsu',
    name: 'Eastern Connecticut',
    group: 'florida',
    dataPath: 'florida/ecsu',
  },
  {
    slug: 'uww',
    name: 'UW-Whitewater',
    group: 'florida',
    dataPath: 'florida/uww',
  },
  {
    slug: 'framingham',
    name: 'Framingham State',
    group: 'florida',
    dataPath: 'florida/framingham',
  },
  {
    slug: 'salemstate',
    name: 'Salem State',
    group: 'florida',
    dataPath: 'florida/salemstate',
  },
].sort((a, b) => a.name.localeCompare(b.name));

export const ALL_OPPONENT_TEAMS: TeamEntry[] = [...OPPONENT_TEAMS, ...FLORIDA_TEAMS];

/**
 * Maps opponent slugs to full institutional names used in Wellesley pitching JSON.
 * Matching is case-insensitive + trimmed to handle quirks like trailing spaces.
 */
export const SLUG_TO_OPPONENT_NAMES: Record<string, string[]> = {
  babson: ['Babson', 'Babson College'],
  clark: ['Clark', 'Clark University'],
  coastguard: ['Coast Guard', 'United States Coast Guard Academy'],
  emerson: ['Emerson', 'Emerson College'],
  mit: ['Mit', 'Massachusetts Institute Of Technology'],
  salve: ['Salve Regina'],
  smith: ['Smith', 'Smith College'],
  springfield: ['Springfield', 'Springfield College'],
  wheaton: ['Wheaton', 'Wheaton College Mass'],
  wpi: ['Wpi', 'Worcester Polytechnic Institute'],
  // Florida trip teams
  wesleyan: ['Wesleyan Conn'],
  uwrf: ['University Of Wisconsin River Falls'],
  brockport: ['Suny Brockport', 'SUNY Brockport'],
  macalester: ['Macalester', 'Macalester College'],
  ecsu: ['Eastern Connecticut', 'Eastern Connecticut State'],
  uww: ['Wis Whitewater', 'University Of Wisconsin Whitewater'],
  framingham: ['Framingham St', 'Framingham State'],
  salemstate: ['Salem State'],
};
