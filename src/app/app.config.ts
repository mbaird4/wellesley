import { provideHttpClient } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import {
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { DataContextService } from '@ws/core/data';

import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideAppInitializer(() => inject(DataContextService).resolveProfile()),
  ],
};
