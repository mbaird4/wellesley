export interface PitchCountInningStats {
  inning: string;
  pasWithSequence: number;
  totalPitches: number;
  balls: number;
  strikes: number;
  sequences: string[];
  firstPitchCount: number;
  firstPitchStrikes: number;
  firstPitchSwingMiss: number;
  firstTwoPitchesCount: number;
  firstTwoPitchesStrike: number;
  firstTwoPitchesSwingMiss: number;
}
