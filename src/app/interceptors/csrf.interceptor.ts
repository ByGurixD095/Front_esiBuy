import {
  HttpBackend,
  HttpClient,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { Observable, catchError, map, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiDiagnosticsService } from '../services/api-diagnostics.service';

interface CsrfConfiguration {
  apiUrl: string;
  csrfEnabled: boolean;
}

export const CSRF_CONFIGURATION = new InjectionToken<CsrfConfiguration>('CSRF_CONFIGURATION', {
  providedIn: 'root',
  factory: () => ({
    apiUrl: environment.apiUrl,
    csrfEnabled: environment.csrfEnabled,
  }),
});

interface CsrfTokenResponse {
  headerName: string;
  token: string;
}

let csrfToken$: Observable<CsrfTokenResponse> | null = null;

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(CSRF_CONFIGURATION);
  const apiUrl = config.apiUrl.replace(/\/+$/, '');
  const isApiRequest = request.url === apiUrl || request.url.startsWith(`${apiUrl}/`);

  if (!config.csrfEnabled || !apiUrl || !isApiRequest || !UNSAFE_METHODS.has(request.method)) {
    return next(request);
  }

  const diagnostics = inject(ApiDiagnosticsService);
  const startedAt = Date.now();

  if (!csrfToken$) {
    const http = new HttpClient(inject(HttpBackend));
    csrfToken$ = http.get<CsrfTokenResponse>(`${apiUrl}/csrf`, { withCredentials: true }).pipe(
      map((response) => {
        if (!response.headerName || !response.token) {
          throw new Error('El backend devolvió una respuesta CSRF incompleta.');
        }
        return response;
      }),
      catchError((error: unknown) => {
        csrfToken$ = null;
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status: unknown }).status) || 0
          : 0;
        diagnostics.record({
          timestamp: new Date().toISOString(),
          requestId: createRequestId(),
          method: 'GET',
          endpoint: '/csrf',
          status,
          category: status === 0 ? 'csrf-network-cors-or-cookie' : 'csrf-bootstrap',
          durationMs: Date.now() - startedAt,
        });
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  return csrfToken$.pipe(
    switchMap(({ headerName, token }) =>
      next(
        request.clone({
          withCredentials: true,
          setHeaders: { [headerName]: token },
        }),
      ),
    ),
  );
};

function createRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resetCsrfTokenCacheForTesting(): void {
  csrfToken$ = null;
}
