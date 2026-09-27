import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeEsAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    // HU-39: PWA. Solo en el build de producción (con ng serve no se registra, para no cachear mientras se desarrolla).
    // Se registra cuando la app queda estable o a los 30 s, para no competir con la carga inicial.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
