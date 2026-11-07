import { HttpBackend, HttpClient, HttpContextToken, HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { Observable, catchError, defer, map, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiDiagnosticsService } from '../services/api-diagnostics.service';

interface CsrfConfiguration { apiUrl: string; csrfEnabled: boolean; }
export const CSRF_CONFIGURATION = new InjectionToken<CsrfConfiguration>('CSRF_CONFIGURATION', {
  providedIn: 'root', factory: () => ({ apiUrl: environment.apiUrl, csrfEnabled: environment.csrfEnabled }),
});
interface CsrfTokenResponse { headerName: string; token: string; }

let token: CsrfTokenResponse | null = null;
let obtainedAt: string | null = null;
let csrfRequest$: Observable<CsrfTokenResponse> | null = null;
export const CSRF_RETRIED_CONTEXT = new HttpContextToken<boolean>(() => false);
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requestCsrfToken(http: HttpClient, diagnostics: ApiDiagnosticsService): Observable<CsrfTokenResponse> {
  if (!csrfRequest$) {
    const url = `${environment.apiUrl.replace(/\/+$/, '')}/csrf`;
    const startedAt = Date.now();
    const requestId = createRequestId();
    csrfRequest$ = defer(() => http.get<CsrfTokenResponse>(url, { withCredentials: true })).pipe(
      map((response) => {
        if (!response.headerName || !response.token) throw new Error('El backend devolvió una respuesta CSRF incompleta.');
        token = response;
        obtainedAt = new Date().toISOString();
        diagnostics.record({ timestamp: new Date().toISOString(), requestId, sourceOrigin: globalThis.location?.origin ?? 'unknown',
          method: 'GET', endpoint: '/csrf', status: 200, category: 'response', durationMs: Date.now() - startedAt,
          credentialsIncluded: true, csrfHeaderPresent: false, csrfTokenObtainedAt: obtainedAt, httpResponseReceived: true });
        return response;
      }),
      catchError((error: unknown) => {
        csrfRequest$ = null;
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        diagnostics.record({ timestamp: new Date().toISOString(), requestId, sourceOrigin: globalThis.location?.origin ?? 'unknown',
          method: 'GET', endpoint: '/csrf', status, category: status ? 'api-response' : 'network-cors',
          durationMs: Date.now() - startedAt, credentialsIncluded: true, csrfHeaderPresent: false,
          csrfTokenObtainedAt: obtainedAt, httpResponseReceived: status !== 0,
          errorType: error instanceof HttpErrorResponse ? error.name : (error as Error)?.name ?? typeof error,
          reason: responseField(error, 'reason'), ...csrfResponseDiagnostics(error) });
        return throwError(() => error);
      }),
      tap({ complete: () => { csrfRequest$ = null; } }),
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
  const diagnostics = inject(ApiDiagnosticsService);
  if (!UNSAFE_METHODS.has(request.method)) {
    if (request.url === `${apiUrl}/csrf`) {
      return next(request.clone({ withCredentials: true })).pipe(tap((response) => {
        const body = response instanceof Object && 'body' in response ? (response as { body: unknown }).body : null;
        if (isCsrfTokenResponse(body)) { token = body; obtainedAt = new Date().toISOString(); }
      }));
    }
    return next(request.clone({ withCredentials: true }));
  }

  const requestId = createRequestId();
  const startedAt = Date.now();
  let didRetry = false;
  const send = (csrf: CsrfTokenResponse, retried: boolean): Observable<HttpEvent<unknown>> => {
    const outgoing = request.clone({ withCredentials: true, setHeaders: { [csrf.headerName]: csrf.token },
      context: retried ? request.context.set(CSRF_RETRIED_CONTEXT, true) : request.context });
    return next(outgoing).pipe(catchError((error: unknown) => {
      const reason = responseField(error, 'reason');
      if (!retried && error instanceof HttpErrorResponse && error.status === 403 &&
          (reason === 'csrf_cookie_missing' || reason === 'csrf_token_mismatch')) {
        didRetry = true;
        token = null;
        return requestCsrfToken(http, diagnostics).pipe(switchMap((fresh) => send(fresh, true)));
      }
      return throwError(() => error);
    }));
  };

  const current = token ? new Observable<CsrfTokenResponse>((subscriber) => { subscriber.next(token!); subscriber.complete(); }) : requestCsrfToken(http, diagnostics);
  return current.pipe(switchMap((csrf) => send(csrf, false)), catchError((error: unknown) => {
    diagnostics.record({ timestamp: new Date().toISOString(), requestId, sourceOrigin: globalThis.location?.origin ?? 'unknown',
      method: request.method, endpoint: safeEndpoint(request.url), status: error instanceof HttpErrorResponse ? error.status : 0,
      httpResponseReceived: error instanceof HttpErrorResponse && error.status !== 0,
      reason: responseField(error, 'reason'), category: error instanceof HttpErrorResponse && error.status ? 'api-response' : 'network-cors',
      durationMs: Date.now() - startedAt, credentialsIncluded: true, csrfHeaderPresent: !!token,
      csrfHeaderName: token?.headerName, csrfTokenObtainedAt: obtainedAt, csrfRenewedOrRetried: didRetry,
      errorType: error instanceof HttpErrorResponse ? error.name : (error as Error)?.name ?? typeof error,
      ...csrfResponseDiagnostics(error),
    });
    return throwError(() => error);
  }));
};

function isCsrfTokenResponse(value: unknown): value is CsrfTokenResponse {
  return !!value && typeof value === 'object' && typeof (value as CsrfTokenResponse).headerName === 'string' && typeof (value as CsrfTokenResponse).token === 'string';
}
function responseField(error: unknown, key: string): unknown {
  if (!(error instanceof HttpErrorResponse) || !error.error || typeof error.error !== 'object') return undefined;
  const value = (error.error as Record<string, unknown>)[key];
  return ['string', 'boolean', 'number'].includes(typeof value) ? value : undefined;
}
function csrfResponseDiagnostics(error: unknown): Record<string, unknown> {
  const keys = ['csrfHeaderPresent', 'csrfCookiePresent', 'accessTokenCookiePresent', 'authorities', 'requiredAuthority'];
  return Object.fromEntries(keys.flatMap((key) => { const value = responseField(error, key); return value === undefined ? [] : [[key, value]]; }));
}
function safeEndpoint(url: string): string { try { return new URL(url, globalThis.location?.origin).pathname; } catch { return url.split('?')[0]; } }
function createRequestId(): string { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
export function resetCsrfTokenCacheForTesting(): void { token = null; obtainedAt = null; csrfRequest$ = null; }
export function getCsrfTokenObtainedAt(): string | null { return obtainedAt; }
