import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { SigninComponent } from './signin.component';
import { NotificationService } from '../../../core/notification.service';
import { AuthService } from '../../../core/auth.service';
import { API, makeToken, userClaim } from '../../../../testing/test-helpers';

describe('SigninComponent', () => {
  let http: HttpTestingController;
  let navigateByUrl: jest.SpyInstance;
  let notify: NotificationService;

  function render(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    navigateByUrl = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SigninComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    http.verify();
    jest.useRealTimers();
  });

  it('disables Continue until an email is typed', async () => {
    const f = render();
    const btn = f.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    f.componentInstance.mailId = '  a@b.com ';
    f.detectChanges();
    expect(btn.disabled).toBe(false);
  });

  it('does nothing for a blank email', () => {
    const f = render();
    f.componentInstance.mailId = '   ';
    f.componentInstance.submit();
    http.expectNone(`${API}/usersignin`);
  });

  it('trims the email, signs in, stores the token and goes to /catalog by default', () => {
    const f = render();
    const success = jest.spyOn(notify, 'success');
    f.componentInstance.mailId = '  reader@example.com ';
    f.componentInstance.submit();
    expect(f.componentInstance.loading()).toBe(true);

    const req = http.expectOne(`${API}/usersignin`);
    expect(req.request.body).toEqual({ mailId: 'reader@example.com' });
    req.flush({ status: 'SUCCESS', data: makeToken({ user: userClaim }) });

    expect(f.componentInstance.loading()).toBe(false);
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(true);
    expect(success).toHaveBeenCalledWith('Signed in successfully');
    expect(navigateByUrl).toHaveBeenCalledWith('/catalog');
  });

  it('honours the ?redirect= query param', () => {
    const f = render({ redirect: '/my-books' });
    f.componentInstance.mailId = 'a@b.com';
    f.componentInstance.submit();
    http.expectOne(`${API}/usersignin`).flush({ status: 'SUCCESS', data: makeToken({ user: userClaim }) });
    expect(navigateByUrl).toHaveBeenCalledWith('/my-books');
  });

  it('shows the server message on an ERROR envelope and stays put', () => {
    const f = render();
    const error = jest.spyOn(notify, 'error');
    f.componentInstance.mailId = 'a@b.com';
    f.componentInstance.submit();
    http.expectOne(`${API}/usersignin`).flush({ status: 'ERROR', data: null, message: 'Blocked' });
    expect(error).toHaveBeenCalledWith('Blocked');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows a connectivity error when the API is unreachable', () => {
    const f = render();
    const error = jest.spyOn(notify, 'error');
    f.componentInstance.mailId = 'a@b.com';
    f.componentInstance.submit();
    http.expectOne(`${API}/usersignin`).error(new ProgressEvent('error'));
    expect(f.componentInstance.loading()).toBe(false);
    expect(error).toHaveBeenCalledWith('Could not reach the API. Is the stack running on :8080?');
  });
});
