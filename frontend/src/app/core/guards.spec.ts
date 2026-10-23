import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { adminGuard, authGuard } from './guards';
import { AuthService } from './auth.service';
import { TokenUser } from '../models';

describe('route guards', () => {
  const user = signal<TokenUser | null>(null);
  const fakeAuth = {
    user,
    isLoggedIn: computed(() => user() !== null),
    isAdmin: computed(() => user()?.role === 'admin'),
  };

  beforeEach(() => {
    user.set(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth }],
    });
  });

  const run = (guard: typeof authGuard, url = '/my-books') =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  const serialize = (r: unknown) => TestBed.inject(Router).serializeUrl(r as UrlTree);

  describe('authGuard', () => {
    it('allows a logged-in user', () => {
      user.set({ userId: '1', mailId: 'a', role: 'user' });
      expect(run(authGuard)).toBe(true);
    });

    it('redirects anonymous users to /signin with a redirect back', () => {
      const result = run(authGuard, '/my-books');
      expect(result).toBeInstanceOf(UrlTree);
      expect(serialize(result)).toBe('/signin?redirect=%2Fmy-books');
    });
  });

  describe('adminGuard', () => {
    it('allows an admin', () => {
      user.set({ userId: '1', mailId: 'a', role: 'admin' });
      expect(run(adminGuard)).toBe(true);
    });

    it('sends a logged-in non-admin to /catalog', () => {
      user.set({ userId: '1', mailId: 'a', role: 'user' });
      expect(serialize(run(adminGuard))).toBe('/catalog');
    });

    it('sends anonymous users to /signin (without a redirect param)', () => {
      expect(serialize(run(adminGuard))).toBe('/signin');
    });
  });
});
