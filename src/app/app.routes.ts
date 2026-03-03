import type { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/lineup',
    pathMatch: 'full',
  },
  {
    path: 'lineup',
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
  {
    path: 'pitching',
    loadComponent: () => import('./pitching/pitching').then((m) => m.Pitching),
  },
  {
    path: 'spray-chart',
    loadComponent: () =>
      import('./spray-chart/spray-chart').then((m) => m.SprayChart),
  },

  { path: '**', redirectTo: '' },
];
