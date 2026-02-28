import type { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./lineup-stats/lineup-stats').then((m) => m.LineupStats),
  },
  {
    path: 'woba',
    loadComponent: () => import('./woba/woba').then((m) => m.Woba),
  },
  {
    path: 'scoring',
    loadComponent: () =>
      import('./scoring-plays/scoring-plays').then((m) => m.ScoringPlays),
  },
  {
    path: 'opponents',
    loadComponent: () =>
      import('./opponents/opponents').then((m) => m.Opponents),
  },
  { path: '**', redirectTo: '' },
];
