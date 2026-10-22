import { TokenUser } from '../app/models';

/** base64url-encode a UTF-8 string the way a JWT does. */
function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds an (unsigned) JWT-shaped token; the client only decodes, never verifies. */
export function makeToken(payload: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.signature`;
}

export const TOKEN_KEY = 'surf_library_token';

export const userClaim: TokenUser = { userId: 'u-1', mailId: 'reader@example.com', role: 'user' };
export const adminClaim: TokenUser = { userId: 'u-admin', mailId: 'admin@surflibrary.dev', role: 'admin' };

/** Puts a valid token for `user` in localStorage (call BEFORE AuthService is created). */
export function loginAs(user: TokenUser, expInSeconds = 3600): string {
  const token = makeToken({ user, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expInSeconds });
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export const API = 'http://localhost:8080';
