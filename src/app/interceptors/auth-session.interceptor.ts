import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpContextToken,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ApiDiagnosticsService } from '../services/api-diagnostics.service';

const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);
const refreshInProgress = new BehaviorSubject<boolean>(false);

const isRefreshableRequest = (request: HttpRequest<unknown>): boolean =>
  !request.url.includes('/users/login') &&
  !request.url.includes('/users/refresh') &&
  !request.url.includes('/users/logout') &&
  !request.url.includes('/mfa/') &&
  !request.url.includes('/users/recover-password') &&
  !request.url.includes('/users/reset-password');

export const authSessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const diagnostics = inject(ApiDiagnosticsService);
  const isApiRequest = request.url.startsWith(environment.apiUrl);
  const finalRequest = isApiRequest ? request.clone({ withCredentials: true }) : request;
  const startedAt = Date.now();
  const requestId = createRequestId();

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isApiRequest) {
        diagnostics.record({
          timestamp: new Date().toISOString(),
          requestId,
          method: request.method,
          endpoint: safeEndpoint(request.url),
          status: error.status,
          category: classifyError(error.status),
          durationMs: Date.now() - startedAt,
          credentialsIncluded: finalRequest.withCredentials,
          csrfHeaderPresent: [...finalRequest.headers.keys()].some((name) =>
            name.toLowerCase().includes('csrf') || name.toLowerCase().includes('xsrf'),
          ),
        });
      }
      const canRefresh =
        error.status === 401 &&
        isRefreshableRequest(request) &&
        !request.context.get(RETRIED_AFTER_REFRESH);

      if (!canRefresh) {
        return throwError(() => error);
      }

      if (refreshInProgress.value) {
        return refreshInProgress.pipe(
          filter((refreshing) => !refreshing),
          take(1),
          switchMap(() => next(markAsRetried(finalRequest))),
          catchError((refreshError) => throwError(() => refreshError)),
        );
      }

      refreshInProgress.next(true);
      return auth.refresh().pipe(
        switchMap(() => {
          refreshInProgress.next(false);
          return next(markAsRetried(finalRequest));
        }),
        catchError((refreshError) => {
          refreshInProgress.next(false);
          const redirectAfterRefreshFailure = auth.sessionChecked();
          auth.clearSession();
          if (redirectAfterRefreshFailure) {
            void router.navigate(['/login'], {
              queryParams: { returnUrl: router.url },
            });
          }
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function createRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeEndpoint(url: string): string {
  try {
    return new URL(url, globalThis.location?.origin).pathname;
  } catch {
    return url.split('?')[0];
  }
}

function classifyError(status: number): string {
  if (status === 0) return 'network-cors-or-cookie';
  if (status === 401) return 'authentication-or-session';
  if (status === 403) return 'authorization-or-csrf';
  if (status >= 500) return 'api-server';
  return 'http';
}

function markAsRetried(request: HttpRequest<unknown>): HttpRequest<unknown> {
  return request.clone({
    context: request.context.set(RETRIED_AFTER_REFRESH, true),
  });
}
