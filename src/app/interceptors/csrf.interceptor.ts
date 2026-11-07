import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import {
  Observable,
  catchError,
  defer,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../environments/environment';

interface CsrfConfiguration {
  apiUrl: string;
  csrfEnabled: boolean;
}

export const CSRF_CONFIGURATION = new InjectionToken<CsrfConfiguration>('CSRF_CONFIGURATION', {
  providedIn: 'root',
  factory: () => ({ apiUrl: environment.apiUrl, csrfEnabled: environment.csrfEnabled }),
});

interface CsrfTokenResponse {
  headerName: string;
  token: string;
}

let token: CsrfTokenResponse | null = null;
let csrfRequest$: Observable<CsrfTokenResponse> | null = null;
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requestCsrfToken(http: HttpClient): Observable<CsrfTokenResponse> {
  if (!csrfRequest$) {
    const url = `${environment.apiUrl.replace(/\/+$/, '')}/csrf`;
    csrfRequest$ = defer(() =>
      http.get<CsrfTokenResponse>(url, { withCredentials: true, cache: 'no-store' }),
    ).pipe(
      map((response) => {
        if (!isCsrfTokenResponse(response)) {
          throw new Error('El backend devolvió una respuesta CSRF incompleta.');
        }
        token = response;
        return response;
      }),
      catchError((error: unknown) => {
        csrfRequest$ = null;
        return throwError(() => error);
      }),
      tap({
        complete: () => {
          csrfRequest$ = null;
        },
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  return csrfRequest$;
}

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(CSRF_CONFIGURATION);
  const apiUrl = config.apiUrl.replace(/\/+$/, '');
  const isApiRequest = request.url === apiUrl || request.url.startsWith(`${apiUrl}/`);
  if (!config.csrfEnabled || !apiUrl || !isApiRequest) return next(request);

  const http = new HttpClient(inject(HttpBackend));
  if (!UNSAFE_METHODS.has(request.method)) {
    if (request.url === `${apiUrl}/csrf`) {
      return next(request.clone({ withCredentials: true })).pipe(
        tap((response) => {
          const body =
            response && typeof response === 'object' && 'body' in response
              ? (response as { body: unknown }).body
              : null;
          if (isCsrfTokenResponse(body)) token = body;
        }),
      );
    }
    return next(request.clone({ withCredentials: true }));
  }

  let retried = false;
  const send = (csrf: CsrfTokenResponse, isRetry = false): Observable<HttpEvent<unknown>> =>
    next(
      request.clone({
        withCredentials: true,
        setHeaders: { [csrf.headerName]: csrf.token },
      }),
    ).pipe(
      catchError((error: unknown) => {
        const reason = responseField(error, 'reason');
        if (
          !isRetry &&
          error instanceof HttpErrorResponse &&
          error.status === 403 &&
          (reason === 'csrf_cookie_missing' || reason === 'csrf_token_mismatch')
        ) {
          retried = true;
          token = null;
          return requestCsrfToken(http).pipe(switchMap((fresh) => send(fresh, true)));
        }
        return throwError(() => error);
      }),
    );

  const current = token ? of(token) : requestCsrfToken(http);
  return current.pipe(
    switchMap((csrf) => send(csrf)),
    catchError((error: unknown) => {
      if (retried) token = null;
      return throwError(() => error);
    }),
  );
};

function isCsrfTokenResponse(value: unknown): value is CsrfTokenResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as CsrfTokenResponse).headerName === 'string' &&
    typeof (value as CsrfTokenResponse).token === 'string'
  );
}

function responseField(error: unknown, key: string): unknown {
  if (!(error instanceof HttpErrorResponse) || !error.error || typeof error.error !== 'object') {
    return undefined;
  }
  return (error.error as Record<string, unknown>)[key];
}

export function resetCsrfTokenCacheForTesting(): void {
  token = null;
  csrfRequest$ = null;
}
