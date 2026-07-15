import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse, TokenUser } from '../models';

const TOKEN_KEY = 'surf_library_token';

interface JwtPayload {
  user?: TokenUser;
  iat?: number;
  exp?: number;
}

/**
 * Owns the JWT: stores it, decodes the `user` claim client-side (the server has
 * no /me endpoint), and exposes role/login state as signals so the nav and
 * guards stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  private readonly _user = signal<TokenUser | null>(this.loadUserFromStorage());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  /** POST /usersignin, then persist + decode the returned token on success. */
  signin(mailId: string): Observable<ApiResponse<string>> {
    return this.api.signin(mailId).pipe(
      tap((res) => {
        if (res.status === 'SUCCESS' && typeof res.data === 'string') {
          this.setToken(res.data);
        }
      }),
    );
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
    this._user.set(null);
  }

  get token(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private setToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
    this._user.set(this.decode(token)?.user ?? null);
  }

  private loadUserFromStorage(): TokenUser | null {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return null;
    const payload = this.decode(token);
    // Drop expired tokens so the UI doesn't pretend to be logged in.
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return payload?.user ?? null;
  }

  private decode(token: string): JwtPayload | null {
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }
}
