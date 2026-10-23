import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { CatalogComponent } from './catalog.component';
import { NotificationService } from '../../core/notification.service';
import { authInterceptor } from '../../core/auth.interceptor';
import { Book } from '../../models';
import { API, loginAs, userClaim } from '../../../testing/test-helpers';

const mk = (bookName: string, o: Partial<Book> = {}): Book => ({
  bookId: bookName,
  bookName,
  authorName: 'Author ' + bookName,
  language: 'English',
  genre: 'Fiction',
  available: true,
  donatedBy: 'Donor',
  ...o,
});

const BOOKS: Book[] = [
  mk('Dune', { genre: 'Sci-Fi', authorName: 'Frank Herbert' }),
  mk('Emma', { genre: 'Romance', available: false }),
  mk('Neuromancer', { genre: 'Sci-Fi', donatedBy: 'Gibson Fan', language: 'French' }),
];

describe('CatalogComponent', () => {
  let fixture: ComponentFixture<CatalogComponent>;
  let cmp: CatalogComponent;
  let http: HttpTestingController;
  let notify: NotificationService;
  let navigate: jest.SpyInstance;

  function render({ loggedIn = false } = {}) {
    if (loggedIn) loginAs(userClaim);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CatalogComponent);
    cmp = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit
  }

  function flushInitial(books: Book[] = BOOKS, reservations: any[] = []) {
    http.expectOne(`${API}/getallbooks`).flush({ status: 'SUCCESS', data: books });
    if (cmp['auth'].isLoggedIn()) {
      http.expectOne(`${API}/myreservations`).flush({ status: 'SUCCESS', data: reservations });
    }
    fixture.detectChanges();
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    http.verify();
    jest.useRealTimers();
  });

  it('anonymous: loads the catalog but not reservations', () => {
    render();
    expect(cmp.loading()).toBe(true);
    http.expectOne(`${API}/getallbooks`).flush({ status: 'SUCCESS', data: BOOKS });
    http.expectNone(`${API}/myreservations`);
    fixture.detectChanges();
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('app-book-card')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.count')?.textContent).toContain('3 books');
  });

  it('logged in: also loads my reservations and maps them by book', () => {
    render({ loggedIn: true });
    flushInitial(BOOKS, [{ bookName: 'Emma', status: 'waiting', position: 2 }]);
    expect(cmp.resMap().get('Emma')?.position).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('In queue · #2');
  });

  it('treats an ERROR envelope from /getallbooks as an empty catalog', () => {
    render();
    http.expectOne(`${API}/getallbooks`).flush({ status: 'ERROR', data: null, message: 'No Books' });
    fixture.detectChanges();
    expect(cmp.allBooks()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No books match');
  });

  it('shows an error state with retry when the API fails', () => {
    render();
    http.expectOne(`${API}/getallbooks`).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(cmp.error()).toBe('The API did not respond. Please try again in a moment.');
    (fixture.nativeElement.querySelector('.state.error button') as HTMLButtonElement).click();
    http.expectOne(`${API}/getallbooks`).flush({ status: 'SUCCESS', data: BOOKS });
    expect(cmp.error()).toBeNull();
    expect(cmp.allBooks()).toHaveLength(3);
  });

  describe('client-side filtering', () => {
    beforeEach(() => {
      render();
      flushInitial();
    });

    it('derives a sorted, unique genre list', () => {
      expect(cmp.genres()).toEqual(['Romance', 'Sci-Fi']);
    });

    it('free text matches name, author, genre, donor or language case-insensitively', () => {
      cmp.q.set('  HERBERT ');
      expect(cmp.visible().map((b) => b.bookName)).toEqual(['Dune']);
      cmp.q.set('gibson');
      expect(cmp.visible().map((b) => b.bookName)).toEqual(['Neuromancer']);
      cmp.q.set('french');
      expect(cmp.visible().map((b) => b.bookName)).toEqual(['Neuromancer']);
    });

    it('filters by genre and availability together', () => {
      cmp.genreFilter.set('Sci-Fi');
      expect(cmp.visible()).toHaveLength(2);
      cmp.genreFilter.set('');
      cmp.availableOnly.set(true);
      expect(cmp.visible().map((b) => b.bookName)).toEqual(['Dune', 'Neuromancer']);
    });
  });

  describe('borrow', () => {
    it('prompts sign-in when anonymous', () => {
      render();
      flushInitial();
      const info = jest.spyOn(notify, 'info');
      cmp.borrow(BOOKS[0]);
      expect(info).toHaveBeenCalledWith('Please sign in first.');
      expect(navigate).toHaveBeenCalledWith(['/signin'], { queryParams: { redirect: '/catalog' } });
      http.expectNone(`${API}/lendbook`);
    });

    it("lends with today's date, marks the book unavailable and refreshes reservations", () => {
      jest.setSystemTime(new Date('2025-06-15T10:00:00Z'));
      render({ loggedIn: true });
      flushInitial();
      const success = jest.spyOn(notify, 'success');

      cmp.borrow(BOOKS[0]);
      expect(cmp.lendingName()).toBe('Dune');
      const req = http.expectOne(`${API}/lendbook`);
      expect(req.request.body).toEqual({ bookName: 'Dune', lendDate: '2025-06-15' });
      expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
      req.flush({ status: 'SUCCESS', data: {} });
      http.expectOne(`${API}/myreservations`).flush({ status: 'SUCCESS', data: [] });

      expect(cmp.lendingName()).toBeNull();
      expect(success).toHaveBeenCalledWith('Borrowed "Dune"');
      expect(cmp.allBooks().find((b) => b.bookName === 'Dune')?.available).toBe(false);
    });

    it('surfaces the server message on ERROR and leaves the book available', () => {
      render({ loggedIn: true });
      flushInitial();
      const error = jest.spyOn(notify, 'error');
      cmp.borrow(BOOKS[0]);
      http.expectOne(`${API}/lendbook`).flush({ status: 'ERROR', data: null, message: 'Dune is reserved for the next person in the queue.' });
      expect(error).toHaveBeenCalledWith('Dune is reserved for the next person in the queue.');
      expect(cmp.allBooks()[0].available).toBe(true);
    });

    it('handles HTTP failure', () => {
      render({ loggedIn: true });
      flushInitial();
      const error = jest.spyOn(notify, 'error');
      cmp.borrow(BOOKS[0]);
      http.expectOne(`${API}/lendbook`).flush('x', { status: 500, statusText: 'err' });
      expect(error).toHaveBeenCalledWith('Could not borrow this book.');
      expect(cmp.lendingName()).toBeNull();
    });
  });

  describe('reserve', () => {
    it('prompts sign-in when anonymous', () => {
      render();
      flushInitial();
      cmp.reserve(BOOKS[1]);
      expect(navigate).toHaveBeenCalled();
      http.expectNone(`${API}/reservebook`);
    });

    it('reserves, shows the server message and reloads the queue positions', () => {
      render({ loggedIn: true });
      flushInitial();
      const success = jest.spyOn(notify, 'success');
      cmp.reserve(BOOKS[1]);
      expect(cmp.reservingName()).toBe('Emma');
      http.expectOne(`${API}/reservebook`).flush({ status: 'SUCCESS', data: {}, message: "Reserved — you're #1" });
      http.expectOne(`${API}/myreservations`).flush({ status: 'SUCCESS', data: [{ bookName: 'Emma', status: 'waiting', position: 1 }] });
      expect(success).toHaveBeenCalledWith("Reserved — you're #1");
      expect(cmp.reservingName()).toBeNull();
      expect(cmp.resMap().get('Emma')?.position).toBe(1);
    });

    it('reports an ERROR envelope', () => {
      render({ loggedIn: true });
      flushInitial();
      const error = jest.spyOn(notify, 'error');
      cmp.reserve(BOOKS[1]);
      http.expectOne(`${API}/reservebook`).flush({ status: 'ERROR', data: null, message: 'already on loan' });
      expect(error).toHaveBeenCalledWith('already on loan');
    });
  });

  describe('server (precise) search', () => {
    it('requires sign-in', () => {
      render();
      flushInitial();
      cmp.runServerSearch();
      expect(navigate).toHaveBeenCalled();
    });

    it('asks for at least one field', () => {
      render({ loggedIn: true });
      flushInitial();
      const info = jest.spyOn(notify, 'info');
      cmp.adv = { bookName: '  ', authorName: '' };
      cmp.runServerSearch();
      expect(info).toHaveBeenCalledWith('Enter at least one field to search.');
      http.expectNone((r) => r.url.includes('/getbookbyquery'));
    });

    it('sends trimmed non-empty fields and replaces the list with server results', () => {
      render({ loggedIn: true });
      flushInitial();
      cmp.adv = { bookName: ' Dune ', authorName: '', genre: 'Sci-Fi' };
      cmp.runServerSearch();
      const req = http.expectOne((r) => r.url === `${API}/getbookbyquery`);
      expect(req.request.params.get('bookName')).toBe('Dune');
      expect(req.request.params.get('genre')).toBe('Sci-Fi');
      expect(req.request.params.has('authorName')).toBe(false);
      req.flush({ status: 'SUCCESS', data: [BOOKS[0]] });
      expect(cmp.serverResult()).toBe(true);
      expect(cmp.allBooks()).toEqual([BOOKS[0]]);
    });

    it('empties the list and shows the message when nothing matches', () => {
      render({ loggedIn: true });
      flushInitial();
      const info = jest.spyOn(notify, 'info');
      cmp.adv = { genre: 'Nope' };
      cmp.runServerSearch();
      http.expectOne((r) => r.url === `${API}/getbookbyquery`).flush({ status: 'ERROR', data: null, message: 'The Request Is Not Available' });
      expect(cmp.allBooks()).toEqual([]);
      expect(info).toHaveBeenCalledWith('The Request Is Not Available');
    });

    it('shows an error state when the search request fails', () => {
      render({ loggedIn: true });
      flushInitial();
      cmp.adv = { genre: 'x' };
      cmp.runServerSearch();
      http.expectOne((r) => r.url === `${API}/getbookbyquery`).error(new ProgressEvent('error'));
      expect(cmp.error()).toBe('Search failed. Please try again.');
    });
  });
});
