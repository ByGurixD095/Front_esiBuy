import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authSessionInterceptor } from './interceptors/auth-session.interceptor';
import { csrfInterceptor } from './interceptors/csrf.interceptor';
import { AuthService } from './services/auth.service';
import { provideAppInitializer, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, switchMap } from 'rxjs';
import { environment } from '../environments/environment';
import { requestCsrfToken } from './interceptors/csrf.interceptor';
import { ApiDiagnosticsService } from './services/api-diagnostics.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([csrfInterceptor, authSessionInterceptor])),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      if (!environment.csrfEnabled) return auth.checkSessionOnLoad();
      return requestCsrfToken(inject(HttpClient), inject(ApiDiagnosticsService)).pipe(
        catchError(() => of(null)),
        switchMap(() => auth.checkSessionOnLoad()),
      );
    }),
  ],
};
