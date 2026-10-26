import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService, Rol } from '../services/auth.service';

export const roleGuard = (roles: readonly Rol[]): CanActivateFn => (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const checkRoles = () =>
    auth.hasRole(roles)
      ? true
      : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  if (auth.sessionChecked()) {
    return checkRoles();
  }

  return auth.checkSessionOnLoad().pipe(
    map(() => checkRoles())
  );
};