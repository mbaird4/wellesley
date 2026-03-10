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
