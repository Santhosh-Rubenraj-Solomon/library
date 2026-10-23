import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminComponent } from './admin.component';
import { NotificationService } from '../../core/notification.service';
import { Book, User } from '../../models';
import { API, adminClaim, loginAs } from '../../../testing/test-helpers';

const book = (bookName: string, o: Partial<Book> = {}): Book => ({
  bookId: 'id-' + bookName,
  bookName,
  authorName: 'A',
  language: 'EN',
  genre: 'G',
  available: true,
  donatedBy: 'D',
  ...o,
});
const SUPER = 'santhoshrubenc@gmail.com';
const USERS: User[] = [
  { userId: '1', mailId: SUPER, role: 'admin' },
  { userId: '2', mailId: adminClaim.mailId, role: 'admin' },
  { userId: '3', mailId: 'other-admin@x.io', role: 'admin' },
  { userId: '4', mailId: 'reader@x.io', role: 'user', visitCount: 7 },
];

describe('AdminComponent', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let cmp: AdminComponent;
  let http: HttpTestingController;
  let notify: NotificationService;
  const ok = (data: any, message?: string) => ({ status: 'SUCCESS', data, message });
  const err = (message: string) => ({ status: 'ERROR', data: null, message });

  beforeEach(() => {
    jest.useFakeTimers();
    loginAs(adminClaim);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    fixture = TestBed.createComponent(AdminComponent);
    cmp = fixture.componentInstance;
    window.scrollTo = jest.fn();
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    jest.useRealTimers();
  });

  const flushBooks = (books: Book[] = [book('Dune'), book('Emma', { available: false })]) => {
    http.expectOne(`${API}/getallbooks`).flush(ok(books));
    fixture.detectChanges();
  };
  const fill = () => (cmp.form = { bookName: 'New', authorName: 'Au', language: 'EN', genre: 'G', donatedBy: 'Me' });

  describe('books tab', () => {
    it('loads the catalog on init and renders In/Out status', () => {
      flushBooks();
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(rows[0].textContent).toContain('In');
      expect(rows[1].textContent).toContain('Out');
    });

    it('notifies when the catalog fails to load', () => {
      const error = jest.spyOn(notify, 'error');
      http.expectOne(`${API}/getallbooks`).error(new ProgressEvent('error'));
      expect(error).toHaveBeenCalledWith('Could not load books.');
      expect(cmp.loading()).toBe(false);
    });

    it('refuses to save when any field is blank', () => {
      flushBooks();
      const error = jest.spyOn(notify, 'error');
      fill();
      cmp.form.genre = '   ';
      cmp.saveBook();
      expect(error).toHaveBeenCalledWith('All fields are required.');
      http.expectNone(`${API}/postnewbook`);
    });

    it('adds a new book via POST, resets the form and reloads', () => {
      flushBooks();
      const success = jest.spyOn(notify, 'success');
      fill();
      cmp.saveBook();
      expect(cmp.saving()).toBe(true);
      const req = http.expectOne(`${API}/postnewbook`);
      expect(req.request.body).toEqual({ bookName: 'New', authorName: 'Au', language: 'EN', genre: 'G', donatedBy: 'Me' });
      req.flush(ok(book('New'), 'New book added successfully'));
      expect(success).toHaveBeenCalledWith('New book added successfully');
      expect(cmp.form.bookName).toBe('');
      expect(cmp.saving()).toBe(false);
      flushBooks();
    });

    it('edit() fills the form; saving then uses PUT /updatebook', () => {
      flushBooks();
      cmp.edit(book('Dune', { authorName: 'Herbert' }));
      expect(cmp.editing()).toBe(true);
      expect(cmp.form).toEqual({ bookName: 'Dune', authorName: 'Herbert', language: 'EN', genre: 'G', donatedBy: 'D' });
      cmp.form.genre = 'Sci-Fi';
      cmp.saveBook();
      const req = http.expectOne(`${API}/updatebook`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.genre).toBe('Sci-Fi');
      req.flush(ok(null, 'The Book Dune Updated successfully'));
      expect(cmp.editing()).toBe(false);
      flushBooks();
    });

    it('shows the server message when saving fails with ERROR', () => {
      flushBooks();
      const error = jest.spyOn(notify, 'error');
      fill();
      cmp.saveBook();
      http.expectOne(`${API}/postnewbook`).flush(err('Invalid Input : New Is Already In The Library'));
      expect(error).toHaveBeenCalledWith('Invalid Input : New Is Already In The Library');
      expect(cmp.form.bookName).toBe('New'); // form kept for correction
    });

    it('resetForm leaves edit mode', () => {
      cmp.edit(book('Dune'));
      cmp.resetForm();
      expect(cmp.editing()).toBe(false);
      expect(cmp.form.bookName).toBe('');
      flushBooks();
    });

    it('remove() does nothing when the confirm dialog is cancelled', () => {
      flushBooks();
      window.confirm = jest.fn(() => false);
      cmp.remove(book('Dune'));
      http.expectNone((r) => r.url.includes('/deletebook'));
    });

    it('remove() deletes after confirmation and drops the row locally', () => {
      flushBooks();
      window.confirm = jest.fn(() => true);
      cmp.remove(book('Dune'));
      const req = http.expectOne((r) => r.url === `${API}/deletebook`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.params.get('bookName')).toBe('Dune');
      req.flush(ok(null, 'The Book Dune Deleted successfully'));
      expect(cmp.books().map((b) => b.bookName)).toEqual(['Emma']);
    });

    it('remove() keeps the row when the server says ERROR', () => {
      flushBooks();
      window.confirm = jest.fn(() => true);
      const error = jest.spyOn(notify, 'error');
      cmp.remove(book('Dune'));
      http.expectOne((r) => r.url === `${API}/deletebook`).flush(err('Invalid Input : Book Unavailable'));
      expect(error).toHaveBeenCalledWith('Invalid Input : Book Unavailable');
      expect(cmp.books()).toHaveLength(2);
    });
  });

  describe('members tab', () => {
    beforeEach(() => {
      flushBooks();
      cmp.switch('users');
      http.expectOne(`${API}/getusers`).flush(ok(USERS));
      fixture.detectChanges();
    });

    const rowFor = (mail: string) =>
      (Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[]).find((r) => r.textContent?.includes(mail))!;

    it('lists members, marks "you", and shows visit counts', () => {
      expect(cmp.users()).toHaveLength(4);
      expect(rowFor(adminClaim.mailId).textContent).toContain('you');
      expect(rowFor('reader@x.io').textContent).toContain('7');
    });

    it('cannot demote the primary admin or yourself from the UI', () => {
      expect((rowFor(SUPER).querySelector('button') as HTMLButtonElement).disabled).toBe(true);
      expect((rowFor(adminClaim.mailId).querySelector('button') as HTMLButtonElement).disabled).toBe(true);
      expect((rowFor('other-admin@x.io').querySelector('button') as HTMLButtonElement).disabled).toBe(false);
    });

    it('promotes a member and updates the row in place', () => {
      const success = jest.spyOn(notify, 'success');
      (rowFor('reader@x.io').querySelector('button') as HTMLButtonElement).click();
      expect(cmp.busy()).toBe('reader@x.io');
      const req = http.expectOne(`${API}/setrole`);
      expect(req.request.body).toEqual({ mailId: 'reader@x.io', role: 'admin' });
      req.flush(ok({}, 'reader@x.io is now admin.'));
      expect(success).toHaveBeenCalledWith('reader@x.io is now admin.');
      expect(cmp.users().find((u) => u.mailId === 'reader@x.io')?.role).toBe('admin');
      expect(cmp.busy()).toBeNull();
    });

    it('shows the server error body for 4xx responses (e.g. 403 primary admin)', () => {
      const error = jest.spyOn(notify, 'error');
      cmp.setRole(USERS[0], 'user');
      http
        .expectOne(`${API}/setrole`)
        .flush({ status: 'ERROR', message: 'The primary admin cannot be demoted.' }, { status: 403, statusText: 'Forbidden' });
      expect(error).toHaveBeenCalledWith('The primary admin cannot be demoted.');
      expect(cmp.users()[0].role).toBe('admin');
    });

    it('falls back to a generic message when the error has no body', () => {
      const error = jest.spyOn(notify, 'error');
      cmp.setRole(USERS[3], 'admin');
      http.expectOne(`${API}/setrole`).error(new ProgressEvent('error'));
      expect(error).toHaveBeenCalledWith('Could not change the role.');
    });
  });

  it('members tab: notifies when /getusers fails', () => {
    flushBooks();
    const error = jest.spyOn(notify, 'error');
    cmp.switch('users');
    http.expectOne(`${API}/getusers`).flush('x', { status: 403, statusText: 'Forbidden' });
    expect(error).toHaveBeenCalledWith('Could not load members.');
    expect(cmp.users()).toEqual([]);
  });

  it('BUG: members tab throws when /getusers returns an empty body (backend sends nothing when there are no users)', () => {
    // Backend user-routes.ts:69 returns undefined for an empty user list, so the
    // response body is empty → HttpClient yields null and `res.status` throws in
    // AdminComponent.loadUsers (admin.component.ts:359), leaving loading=true.
    flushBooks();
    cmp.switch('users');
    http.expectOne(`${API}/getusers`).flush(null);
    // RxJS reports the error thrown inside `next` asynchronously (setTimeout).
    expect(() => jest.runOnlyPendingTimers()).toThrow(/Cannot read properties of null \(reading 'status'\)/);
    expect(cmp.loading()).toBe(true); // spinner never clears
  });

  it('lending tab loads lent + returned and stays loading until both settle', () => {
    flushBooks();
    cmp.switch('lending');
    expect(cmp.loading()).toBe(true);
    http.expectOne(`${API}/getlendedbooks`).flush(ok([{ lendId: 'l1', bookName: 'Dune', mailId: 'r@x', lendDate: '2025-01-01' }]));
    expect(cmp.loading()).toBe(true);
    http.expectOne(`${API}/getreturnedbooks`).flush(err('No Books Returned'));
    fixture.detectChanges();
    expect(cmp.loading()).toBe(false);
    expect(cmp.lent()).toHaveLength(1);
    expect(cmp.returned()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Currently lent (1)');
    expect(fixture.nativeElement.textContent).toContain('No returns recorded');
  });

  it('switching back to books reloads the catalog', () => {
    flushBooks();
    cmp.switch('books');
    flushBooks([book('Only')]);
    expect(cmp.books().map((b) => b.bookName)).toEqual(['Only']);
  });
});
