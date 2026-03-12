import type { SprayChartSummary } from '@ws/core/models';

export interface PrintPlayerSummary {
  name: string;
  jersey: number;
  summary: SprayChartSummary;
  bats?: 'L' | 'R' | 'S' | null;
  position?: string | null;
  avg?: number;
  woba?: number;
  pa?: number;
  sb?: number;
  sbAtt?: number;
  gp?: number;
  sh?: number;
  slg?: number;
  so?: number;
  rbi?: number;
  h?: number;
  bb?: number;
  ab?: number;
  doubles?: number;
  triples?: number;
  hr?: number;
}
