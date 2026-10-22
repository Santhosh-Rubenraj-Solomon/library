import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { API, TOKEN_KEY, adminClaim, loginAs, makeToken, userClaim } from '../../testing/test-helpers';

describe('AuthService', () => {
  let http: HttpTestingController;

  function create(): AuthService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  afterEach(() => http?.verify());

  it('starts logged out with no stored token', () => {
    const auth = create();
    expect(auth.user()).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.token).toBeNull();
  });

  it('restores the user from a stored, unexpired token', () => {
    const token = loginAs(userClaim);
    const auth = create();
    expect(auth.user()).toEqual(userClaim);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.token).toBe(token);
  });

  it('isAdmin is true for an admin claim', () => {
    loginAs(adminClaim);
    expect(create().isAdmin()).toBe(true);
  });

  it('drops an expired stored token', () => {
    loginAs(userClaim, -10);
    const auth = create();
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('treats a stored token without exp as valid', () => {
    localStorage.setItem(TOKEN_KEY, makeToken({ user: userClaim }));
    expect(create().isLoggedIn()).toBe(true);
  });

  it('treats a malformed stored token as logged out (but leaves it in storage)', () => {
    localStorage.setItem(TOKEN_KEY, 'garbage');
    const auth = create();
    expect(auth.isLoggedIn()).toBe(false);
    // Note: the junk token is not cleaned up and the interceptor will still send it.
    expect(auth.token).toBe('garbage');
  });

  it('decodes base64url payloads containing non-ASCII characters', () => {
    const claim = { ...userClaim, mailId: 'zoë+ñ@exämple.com' };
    localStorage.setItem(TOKEN_KEY, makeToken({ user: claim }));
    expect(create().user()?.mailId).toBe('zoë+ñ@exämple.com');
  });

  it('signin stores the token and decodes the user on SUCCESS', () => {
    const auth = create();
    const token = makeToken({ user: adminClaim });
    let emitted: unknown;
    auth.signin('admin@surflibrary.dev').subscribe((r) => (emitted = r));

    const req = http.expectOne(`${API}/usersignin`);
    expect(req.request.body).toEqual({ mailId: 'admin@surflibrary.dev' });
    req.flush({ status: 'SUCCESS', data: token });

    expect(emitted).toEqual({ status: 'SUCCESS', data: token });
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
    expect(auth.user()).toEqual(adminClaim);
    expect(auth.isAdmin()).toBe(true);
  });

  it('signin does not store anything on ERROR', () => {
    const auth = create();
    auth.signin('x@y.z').subscribe();
    http.expectOne(`${API}/usersignin`).flush({ status: 'ERROR', data: null, message: 'nope' });
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('signin ignores a non-string data payload', () => {
    const auth = create();
    auth.signin('x@y.z').subscribe();
    http.expectOne(`${API}/usersignin`).flush({ status: 'SUCCESS', data: { token: 'x' } });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('signin propagates HTTP errors without changing state', () => {
    const auth = create();
    const err = jest.fn();
    auth.signin('x@y.z').subscribe({ error: err });
    http.expectOne(`${API}/usersignin`).flush('down', { status: 502, statusText: 'Bad Gateway' });
    expect(err).toHaveBeenCalled();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('logout clears storage and state', () => {
    loginAs(userClaim);
    const auth = create();
    auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.token).toBeNull();
  });
});
