import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

/** Routes the server treats as public — never send a token to these. */
const PUBLIC_PATHS = ['/usersignin', '/getallbooks', '/healthcheck'];

/** Attaches `Authorization: Bearer <token>` to every non-public request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const isPublic = PUBLIC_PATHS.some((path) => req.url.includes(path));

  if (token && !isPublic) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
