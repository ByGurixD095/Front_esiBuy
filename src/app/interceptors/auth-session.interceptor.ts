import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpContextToken,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ApiDiagnosticsService } from '../services/api-diagnostics.service';
import { CSRF_RETRIED_CONTEXT, getCsrfTokenObtainedAt } from './csrf.interceptor';

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
  const isCsrfBootstrap = request.url === `${environment.apiUrl.replace(/\/+$/, '')}/csrf`;
  const finalRequest = isApiRequest ? request.clone({ withCredentials: true }) : request;
  const startedAt = Date.now();
  const requestId = createRequestId();

  return next(finalRequest).pipe(
    tap((response) => {
      if (!isApiRequest || isCsrfBootstrap) return;
      const body = response && typeof response === 'object' && 'body' in response
        ? (response as { body: unknown }).body : null;
      diagnostics.record({
        timestamp: new Date().toISOString(), requestId, sourceOrigin: globalThis.location?.origin ?? 'unknown',
        method: request.method, endpoint: safeEndpoint(request.url), status: responseStatus(response), category: 'response',
        httpResponseReceived: true,
        durationMs: Date.now() - startedAt, credentialsIncluded: finalRequest.withCredentials,
        csrfHeaderPresent: csrfHeaderName(finalRequest) !== undefined, csrfHeaderName: csrfHeaderName(finalRequest),
        csrfTokenObtainedAt: getCsrfTokenObtainedAt(), csrfRenewedOrRetried: request.context.get(CSRF_RETRIED_CONTEXT),
        ...safeApiDetails(body),
      });
    }),
    catchError((error: HttpErrorResponse) => {
      if (isApiRequest && !isCsrfBootstrap) {
        diagnostics.record({
          timestamp: new Date().toISOString(),
          requestId,
          sourceOrigin: globalThis.location?.origin ?? 'unknown',
          method: request.method,
          endpoint: safeEndpoint(request.url),
          status: error.status,
          httpResponseReceived: error.status !== 0,
          category: classifyError(error.status),
          durationMs: Date.now() - startedAt,
          credentialsIncluded: finalRequest.withCredentials,
          csrfHeaderPresent: [...finalRequest.headers.keys()].some((name) =>
            name.toLowerCase().includes('csrf') || name.toLowerCase().includes('xsrf'),
          ),
          csrfHeaderName: csrfHeaderName(finalRequest),
          csrfTokenObtainedAt: getCsrfTokenObtainedAt(), csrfRenewedOrRetried: request.context.get(CSRF_RETRIED_CONTEXT),
          errorType: error.name,
          ...safeApiDetails(error.error),
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

function responseStatus(response: unknown): number {
  return response && typeof response === 'object' && 'status' in response
    ? Number((response as { status: unknown }).status) || 0 : 0;
}

function csrfHeaderName(request: HttpRequest<unknown>): string | undefined {
  return request.headers.keys().find((name) => name.toLowerCase().includes('csrf') || name.toLowerCase().includes('xsrf'));
}

function safeApiDetails(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const source = body as Record<string, unknown>;
  const allowed = ['reason', 'csrfHeaderPresent', 'csrfCookiePresent', 'accessTokenCookiePresent', 'authorities', 'requiredAuthority'];
  return Object.fromEntries(allowed.flatMap((key) => {
    const value = source[key];
    return value === undefined || (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number' && !Array.isArray(value))
      ? [] : [[key, value]];
  }));
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
