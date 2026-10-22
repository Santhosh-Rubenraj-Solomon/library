import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MyBooksComponent } from './my-books.component';
import { NotificationService } from '../../core/notification.service';
import { Lend } from '../../models';
import { API, loginAs, userClaim } from '../../../testing/test-helpers';

const lend = (bookName: string, o: Partial<Lend> = {}): Lend => ({
  lendId: 'l-' + bookName,
  userId: userClaim.userId,
  mailId: userClaim.mailId,
  bookName,
  lendDate: '2025-01-01T00:00:00.000Z',
  returnDate: null,
  dueDate: '2099-01-15T00:00:00.000Z',
  returned: false,
  ...o,
});

describe('MyBooksComponent', () => {
  let fixture: ComponentFixture<MyBooksComponent>;
  let cmp: MyBooksComponent;
  let http: HttpTestingController;
  let notify: NotificationService;

  beforeEach(() => {
    jest.useFakeTimers();
    loginAs(userClaim);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    fixture = TestBed.createComponent(MyBooksComponent);
    cmp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    jest.useRealTimers();
  });

  function flushAll(lent: any, returned: any, reservations: any) {
    http.expectOne(`${API}/lendedbooksbyuser`).flush(lent);
    http.expectOne(`${API}/getbooksreturnedbyuser`).flush(returned);
    http.expectOne(`${API}/myreservations`).flush(reservations);
    fixture.detectChanges();
  }
  const ok = (data: any) => ({ status: 'SUCCESS', data });
  const err = (message = 'none') => ({ status: 'ERROR', data: null, message });

  it('stays loading until all three requests settle', () => {
    expect(cmp.loading()).toBe(true);
    http.expectOne(`${API}/lendedbooksbyuser`).flush(err());
    http.expectOne(`${API}/getbooksreturnedbyuser`).flush(err());
    expect(cmp.loading()).toBe(true);
    http.expectOne(`${API}/myreservations`).error(new ProgressEvent('error'));
    expect(cmp.loading()).toBe(false);
  });

  it('wraps the single-object /lendedbooksbyuser response in an array', () => {
    flushAll(ok(lend('Dune')), err(), ok([]));
    expect(cmp.borrowed()).toEqual([lend('Dune')]);
    expect(fixture.nativeElement.textContent).toContain('Dune');
  });

  it('also accepts an array response for borrowed books', () => {
    flushAll(ok([lend('A'), lend('B')]), err(), ok([]));
    expect(cmp.borrowed().map((l) => l.bookName)).toEqual(['A', 'B']);
  });

  it('shows empty states when the endpoints return ERROR envelopes', () => {
    flushAll(err(), err(), ok([]));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nothing on loan');
    expect(text).toContain('No reservations');
    expect(text).toContain('No returns yet');
  });

  it('renders history and reservations (ready vs waiting)', () => {
    flushAll(
      err(),
      ok([lend('Old', { returned: true, returnDate: '2025-01-05T00:00:00.000Z' })]),
      ok([
        { reservationId: 'r1', bookName: 'Ready Book', status: 'ready', position: 1 },
        { reservationId: 'r2', bookName: 'Queued Book', status: 'waiting', position: 3, dueDate: '2025-02-01T00:00:00.000Z' },
      ]),
    );
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Old');
    expect(text).toContain('Ready for you — borrow it now');
    expect(text).toMatch(/#3 in queue/);
    expect(text).toContain('due back');
  });

  it('flags overdue loans', () => {
    jest.setSystemTime(new Date('2025-03-01T00:00:00Z'));
    expect(cmp.isOverdue('2025-02-01T00:00:00Z')).toBe(true);
    expect(cmp.isOverdue('2025-04-01T00:00:00Z')).toBe(false);
    expect(cmp.isOverdue(null)).toBe(false);
    expect(cmp.isOverdue(undefined)).toBe(false);
    flushAll(ok(lend('Late', { dueDate: '2025-02-01T00:00:00Z' })), err(), ok([]));
    expect(fixture.nativeElement.querySelector('.due.overdue')?.textContent).toContain('Overdue');
  });

  it('returnBook: success notifies and reloads everything', () => {
    flushAll(ok(lend('Dune')), err(), ok([]));
    const success = jest.spyOn(notify, 'success');
    (fixture.nativeElement.querySelector('.loan button') as HTMLButtonElement).click();
    expect(cmp.returningName()).toBe('Dune');
    const req = http.expectOne(`${API}/returnbook`);
    expect(req.request.body).toEqual({ bookName: 'Dune' });
    req.flush(ok({}));
    expect(success).toHaveBeenCalledWith('Returned "Dune"');
    expect(cmp.returningName()).toBeNull();
    flushAll(err(), ok([lend('Dune', { returned: true })]), ok([]));
    expect(cmp.borrowed()).toEqual([]);
    expect(cmp.history()).toHaveLength(1);
  });

  it('returnBook: ERROR envelope shows the message and does not reload', () => {
    flushAll(ok(lend('Dune')), err(), ok([]));
    const error = jest.spyOn(notify, 'error');
    cmp.returnBook('Dune');
    http.expectOne(`${API}/returnbook`).flush(err('x Returned The Book Dune'));
    expect(error).toHaveBeenCalledWith('x Returned The Book Dune');
    http.expectNone(`${API}/lendedbooksbyuser`);
  });

  it('returnBook: HTTP failure shows a generic message', () => {
    flushAll(err(), err(), ok([]));
    const error = jest.spyOn(notify, 'error');
    cmp.returnBook('Dune');
    http.expectOne(`${API}/returnbook`).error(new ProgressEvent('error'));
    expect(error).toHaveBeenCalledWith('Could not return this book.');
  });

  it('cancelRes: success reloads; ERROR reports', () => {
    flushAll(err(), err(), ok([]));
    const success = jest.spyOn(notify, 'success');
    const error = jest.spyOn(notify, 'error');

    cmp.cancelRes('Dune');
    expect(cmp.busyRes()).toBe('Dune');
    const req = http.expectOne(`${API}/cancelreservation`);
    expect(req.request.body).toEqual({ bookName: 'Dune' });
    req.flush(ok(null));
    expect(success).toHaveBeenCalledWith('Left the queue for "Dune"');
    flushAll(err(), err(), ok([]));

    cmp.cancelRes('Emma');
    http.expectOne(`${API}/cancelreservation`).flush(err("You don't have an active reservation for this book."));
    expect(error).toHaveBeenCalledWith("You don't have an active reservation for this book.");
    expect(cmp.busyRes()).toBeNull();
  });

  it('borrowReserved: lends with today and reloads on success', () => {
    jest.setSystemTime(new Date('2025-05-05T12:00:00Z'));
    flushAll(err(), err(), ok([{ reservationId: 'r1', bookName: 'Dune', status: 'ready', position: 1 }]));
    const btn = fixture.nativeElement.querySelector('.res-actions .btn:not(.ghost)') as HTMLButtonElement;
    btn.click();
    const req = http.expectOne(`${API}/lendbook`);
    expect(req.request.body).toEqual({ bookName: 'Dune', lendDate: '2025-05-05' });
    req.flush(ok({}));
    flushAll(ok(lend('Dune')), err(), ok([]));
    expect(cmp.borrowed()).toHaveLength(1);
    expect(cmp.reservations()).toEqual([]);
  });
});
