import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { NavBarComponent } from './nav-bar.component';
import { adminClaim, loginAs, userClaim } from '../../../testing/test-helpers';

describe('NavBarComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(NavBarComponent);
    fixture.detectChanges();
    return fixture;
  }
  const links = (f: any) =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('nav.links a')).map((a) => a.textContent?.trim());

  it('anonymous: only Catalog plus a Sign in link', () => {
    const f = render();
    expect(links(f)).toEqual(['Catalog']);
    expect(f.nativeElement.querySelector('.auth a')?.textContent).toContain('Sign in');
  });

  it('user: shows My books and their email, no Admin', () => {
    loginAs(userClaim);
    const f = render();
    expect(links(f)).toEqual(['Catalog', 'My books']);
    expect(f.nativeElement.querySelector('.email')?.textContent).toBe(userClaim.mailId);
    expect(f.nativeElement.querySelector('.badge.role')).toBeNull();
  });

  it('admin: shows Admin link and badge', () => {
    loginAs(adminClaim);
    const f = render();
    expect(links(f)).toEqual(['Catalog', 'My books', 'Admin']);
    expect(f.nativeElement.querySelector('.badge.role')?.textContent).toBe('admin');
  });

  it('Sign out logs out and navigates to /catalog', () => {
    loginAs(userClaim);
    const f = render();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (f.nativeElement.querySelector('.auth button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(nav).toHaveBeenCalledWith(['/catalog']);
    expect(localStorage.length).toBe(0);
    expect(links(f)).toEqual(['Catalog']);
  });
});
