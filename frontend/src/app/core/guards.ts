import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Blocks a route when there is no token; sends the user to /signin. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/signin'], { queryParams: { redirect: state.url } });
};

/**
 * Admin-only. Mirrors the server's adminRoutes list so normal users never see
 * admin screens — the server still enforces 403 regardless.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin()) return true;
  if (auth.isLoggedIn()) return router.createUrlTree(['/catalog']);
  return router.createUrlTree(['/signin']);
};
