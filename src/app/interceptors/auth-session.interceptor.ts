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
  const isApiRequest = request.url.startsWith(environment.apiUrl);
  const finalRequest = isApiRequest ? request.clone({ withCredentials: true }) : request;

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
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

function markAsRetried(request: HttpRequest<unknown>): HttpRequest<unknown> {
  return request.clone({
    context: request.context.set(RETRIED_AFTER_REFRESH, true),
  });
}
