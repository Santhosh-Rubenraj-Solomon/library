import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiResponse,
  Book,
  BookInput,
  BookQuery,
  Lend,
  User,
} from '../models';

/**
 * One method per endpoint (see the endpoint table in BUILD_SPEC.md).
 * Bodies are sent UNWRAPPED — the server wraps them into { data, user }.
 * Query routes (/getbookbyquery, /deletebook) use query params, not bodies.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // --- public ---------------------------------------------------------------

  /** POST /usersignin → data is the JWT string. */
  signin(mailId: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.base}/usersignin`, { mailId });
  }

  /** GET /getallbooks → full catalog. */
  getAllBooks(): Observable<ApiResponse<Book[]>> {
    return this.http.get<ApiResponse<Book[]>>(`${this.base}/getallbooks`);
  }

  /** GET /healthcheck → { status, servedBy }. */
  healthcheck(): Observable<{ status: string; servedBy: string; host?: string }> {
    return this.http.get<{ status: string; servedBy: string; host?: string }>(
      `${this.base}/healthcheck`,
    );
  }

  // --- user -----------------------------------------------------------------

  /** GET /getbookbyquery — any subset of fields. */
  getBookByQuery(query: BookQuery): Observable<ApiResponse<Book[]>> {
    let params = new HttpParams();
    (Object.keys(query) as (keyof BookQuery)[]).forEach((key) => {
      const value = query[key];
      if (value != null && value !== '') {
        params = params.set(key, value);
      }
    });
    return this.http.get<ApiResponse<Book[]>>(`${this.base}/getbookbyquery`, { params });
  }

  /** POST /lendbook — user comes from the token. */
  lendBook(bookName: string, lendDate: string): Observable<ApiResponse<Lend>> {
    return this.http.post<ApiResponse<Lend>>(`${this.base}/lendbook`, { bookName, lendDate });
  }

  /** POST /returnbook — user comes from the token. */
  returnBook(bookName: string): Observable<ApiResponse<Lend>> {
    return this.http.post<ApiResponse<Lend>>(`${this.base}/returnbook`, { bookName });
  }

  /** GET /getbooksreturnedbyuser — reads user from token. */
  getBooksReturnedByUser(): Observable<ApiResponse<Lend[]>> {
    return this.http.get<ApiResponse<Lend[]>>(`${this.base}/getbooksreturnedbyuser`);
  }

  /** GET /lendedbooksbyuser — reads user from token (Task 0 fix). */
  getLendedBooksByUser(): Observable<ApiResponse<Lend>> {
    return this.http.get<ApiResponse<Lend>>(`${this.base}/lendedbooksbyuser`);
  }

  // --- admin ----------------------------------------------------------------

  /** POST /postnewbook. */
  postNewBook(book: BookInput): Observable<ApiResponse<Book>> {
    return this.http.post<ApiResponse<Book>>(`${this.base}/postnewbook`, book);
  }

  /** PUT /updatebook — matched by bookName. */
  updateBook(book: BookInput): Observable<ApiResponse<Book>> {
    return this.http.put<ApiResponse<Book>>(`${this.base}/updatebook`, book);
  }

  /** DELETE /deletebook?bookName=... */
  deleteBook(bookName: string): Observable<ApiResponse<null>> {
    const params = new HttpParams().set('bookName', bookName);
    return this.http.delete<ApiResponse<null>>(`${this.base}/deletebook`, { params });
  }

  /** GET /getusers. */
  getUsers(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.base}/getusers`);
  }

  /** GET /getlendedbooks — currently lent. */
  getLendedBooks(): Observable<ApiResponse<Lend[]>> {
    return this.http.get<ApiResponse<Lend[]>>(`${this.base}/getlendedbooks`);
  }

  /** GET /getreturnedbooks. */
  getReturnedBooks(): Observable<ApiResponse<Lend[]>> {
    return this.http.get<ApiResponse<Lend[]>>(`${this.base}/getreturnedbooks`);
  }
}
