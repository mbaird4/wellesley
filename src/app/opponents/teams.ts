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
