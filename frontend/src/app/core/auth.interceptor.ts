import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

/** Routes the server treats as public — never send a token to these. */
const PUBLIC_PATHS = ['/usersignin', '/getallbooks', '/healthcheck'];

/**
 * The request's path relative to the API base URL (query/hash stripped), so it
 * can be compared EXACTLY against PUBLIC_PATHS. A substring test would also
 * strip the token from protected URLs such as `/getallbooks-archive`.
 */
function apiPath(url: string): string {
  const base = environment.apiBaseUrl.replace(/\/+$/, '');
  let path: string;
  if (base && url.startsWith(base)) {
    path = url.slice(base.length);
  } else {
    try {
      path = new URL(url, 'http://relative.invalid').pathname;
    } catch {
      path = url;
    }
  }
  path = path.split(/[?#]/)[0];
  return path.startsWith('/') ? path : `/${path}`;
}

/** Attaches `Authorization: Bearer <token>` to every non-public request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const isPublic = PUBLIC_PATHS.includes(apiPath(req.url));

  if (token && !isPublic) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
