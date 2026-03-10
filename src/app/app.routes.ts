import type { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/woba',
    pathMatch: 'full',
  },
  {
    path: 'lineup',
    loadComponent: () =>
      import('./lineup-stats/lineup-stats').then((m) => m.LineupStats),
  },
  {
    path: 'woba',
    loadComponent: () => import('@ws/woba').then((m) => m.Woba),
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
    children: [
      { path: '', redirectTo: 'babson', pathMatch: 'full' },
      {
        path: ':slug',
        loadComponent: () =>
          import('./opponents/opponent-detail/opponent-detail').then(
            (m) => m.OpponentDetail
          ),
        children: [
          { path: '', redirectTo: 'spray', pathMatch: 'full' },
          {
            path: 'spray',
            loadComponent: () =>
              import('./opponents/tabs/spray-tab').then((m) => m.SprayTab),
          },
          {
            path: 'woba',
            loadComponent: () =>
              import('./opponents/tabs/woba-tab').then((m) => m.WobaTab),
          },
          {
            path: 'pitching',
            loadComponent: () =>
              import('./opponents/tabs/pitching-tab').then(
                (m) => m.PitchingTab
              ),
          },
          {
            path: 'stats',
            loadComponent: () =>
              import('./opponents/tabs/stats-tab').then((m) => m.StatsTab),
          },
        ],
      },
    ],
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
