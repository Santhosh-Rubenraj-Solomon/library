import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { authInterceptor } from './auth.interceptor';
import { API, loginAs, userClaim } from '../../testing/test-helpers';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  }

  afterEach(() => ctrl.verify());

  it('attaches Bearer <token> to protected requests when logged in', () => {
    const token = loginAs(userClaim);
    setup();
    http.post(`${API}/lendbook`, {}).subscribe();
    const req = ctrl.expectOne(`${API}/lendbook`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush({});
  });

  it.each(['/usersignin', '/getallbooks', '/healthcheck'])('never sends the token to public %s', (path) => {
    loginAs(userClaim);
    setup();
    http.get(`${API}${path}`).subscribe();
    const req = ctrl.expectOne(`${API}${path}`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('sends no header when there is no token', () => {
    setup();
    http.get(`${API}/myreservations`).subscribe();
    const req = ctrl.expectOne(`${API}/myreservations`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('reads the token at request time (picks up a login after the interceptor was created)', () => {
    setup();
    const token = loginAs(userClaim);
    http.get(`${API}/myreservations`).subscribe();
    const req = ctrl.expectOne(`${API}/myreservations`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush({});
  });

  it('quirk: public-path matching is a substring test on the full URL', () => {
    // A protected URL that merely *contains* a public path segment loses its token.
    loginAs(userClaim);
    setup();
    http.get(`${API}/getallbooks-archive`).subscribe();
    const req = ctrl.expectOne(`${API}/getallbooks-archive`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
