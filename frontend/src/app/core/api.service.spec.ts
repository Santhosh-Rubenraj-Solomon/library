import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApiService } from './api.service';
import { API } from '../../testing/test-helpers';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('signin → POST /usersignin with { mailId }', () => {
    let result: unknown;
    api.signin('a@b.com').subscribe((r) => (result = r));
    const req = http.expectOne(`${API}/usersignin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mailId: 'a@b.com' });
    req.flush({ status: 'SUCCESS', data: 'jwt' });
    expect(result).toEqual({ status: 'SUCCESS', data: 'jwt' });
  });

  it.each([
    ['getAllBooks', '/getallbooks'],
    ['healthcheck', '/healthcheck'],
    ['getBooksReturnedByUser', '/getbooksreturnedbyuser'],
    ['getLendedBooksByUser', '/lendedbooksbyuser'],
    ['getUsers', '/getusers'],
    ['getLendedBooks', '/getlendedbooks'],
    ['getReturnedBooks', '/getreturnedbooks'],
    ['getMyReservations', '/myreservations'],
    ['getReservations', '/getreservations'],
  ] as const)('%s → GET %s without a body', (method, path) => {
    (api[method] as () => any)().subscribe();
    const req = http.expectOne(`${API}${path}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    req.flush({});
  });

  it('getBookByQuery sends only non-empty fields as query params', () => {
    api.getBookByQuery({ bookName: 'Dune', authorName: '', genre: 'Sci Fi', language: undefined }).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/getbookbyquery`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['bookName', 'genre']);
    expect(req.request.params.get('genre')).toBe('Sci Fi');
    expect(req.request.urlWithParams).toBe(`${API}/getbookbyquery?bookName=Dune&genre=Sci%20Fi`);
    req.flush({});
  });

  it('lendBook → POST unwrapped { bookName, lendDate }', () => {
    api.lendBook('Dune', '2025-01-01').subscribe();
    const req = http.expectOne(`${API}/lendbook`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ bookName: 'Dune', lendDate: '2025-01-01' });
    req.flush({});
  });

  it.each([
    ['returnBook', '/returnbook'],
    ['reserveBook', '/reservebook'],
    ['cancelReservation', '/cancelreservation'],
  ] as const)('%s → POST %s with { bookName }', (method, path) => {
    (api[method] as (n: string) => any)('Dune').subscribe();
    const req = http.expectOne(`${API}${path}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ bookName: 'Dune' });
    req.flush({});
  });

  const book = { bookName: 'Dune', authorName: 'Herbert', language: 'EN', genre: 'SF', donatedBy: 'Al' };

  it('postNewBook → POST /postnewbook with the book body', () => {
    api.postNewBook(book).subscribe();
    const req = http.expectOne(`${API}/postnewbook`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(book);
    req.flush({});
  });

  it('updateBook → PUT /updatebook with the book body', () => {
    api.updateBook(book).subscribe();
    const req = http.expectOne(`${API}/updatebook`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(book);
    req.flush({});
  });

  it('deleteBook → DELETE /deletebook?bookName= (query param, URL-encoded)', () => {
    api.deleteBook('War & Peace').subscribe();
    const req = http.expectOne((r) => r.url === `${API}/deletebook`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('bookName')).toBe('War & Peace');
    expect(req.request.urlWithParams).toBe(`${API}/deletebook?bookName=War%20%26%20Peace`);
    req.flush({});
  });

  it('setRole → POST /setrole with { mailId, role }', () => {
    api.setRole('x@y.z', 'admin').subscribe();
    const req = http.expectOne(`${API}/setrole`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mailId: 'x@y.z', role: 'admin' });
    req.flush({});
  });
});
