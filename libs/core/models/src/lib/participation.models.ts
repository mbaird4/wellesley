export interface PlayerMeta {
  coachId: string | null;
  eligibilityUsed: boolean | null;
  fallTournament: boolean | null;
  notes: string | null;
}

export type PlayerMetaMap = Record<number, PlayerMeta>;
