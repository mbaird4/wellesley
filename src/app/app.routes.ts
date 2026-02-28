import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./lineup-stats/lineup-stats.component').then(
        (m) => m.LineupStatsComponent
      ),
  },
  {
    path: 'woba',
    loadComponent: () =>
      import('./woba/woba.component').then((m) => m.WobaComponent),
  },
  {
    path: 'scoring',
    loadComponent: () =>
      import('./scoring-plays/scoring-plays.component').then(
        (m) => m.ScoringPlaysComponent
      ),
  },
  {
    path: 'opponents',
    loadComponent: () =>
      import('./opponents/opponents.component').then(
        (m) => m.OpponentsComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
