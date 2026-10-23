import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookCardComponent } from './book-card.component';
import { Book } from '../../models';

const book = (o: Partial<Book> = {}): Book => ({
  bookId: 'b1',
  bookName: 'the left hand of darkness',
  authorName: 'Ursula K. Le Guin',
  language: 'English',
  genre: 'Sci-Fi',
  available: true,
  donatedBy: 'Alice',
  ...o,
});

describe('BookCardComponent', () => {
  let fixture: ComponentFixture<BookCardComponent>;
  let cmp: BookCardComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(el().querySelectorAll('button')) as HTMLButtonElement[];

  function render(inputs: Partial<BookCardComponent> & { book: Book }) {
    fixture = TestBed.createComponent(BookCardComponent);
    cmp = fixture.componentInstance;
    Object.entries(inputs).forEach(([k, v]) => fixture.componentRef.setInput(k, v));
    fixture.detectChanges();
  }

  it('renders the book details', () => {
    render({ book: book() });
    expect(el().querySelector('h3')?.textContent).toContain('the left hand of darkness');
    expect(el().querySelector('.author')?.textContent).toContain('Ursula K. Le Guin');
    expect(el().textContent).toContain('Donated · Alice');
    expect(el().querySelector('.lang')?.textContent).toBe('English');
  });

  it('initials use the first letter of the first two words, upper-cased', () => {
    render({ book: book() });
    expect(cmp.initials).toBe('TL');
    fixture.componentRef.setInput('book', book({ bookName: '  dune ' }));
    expect(cmp.initials).toBe('D');
  });

  it('cover gradient is deterministic per title+genre', () => {
    render({ book: book() });
    const a = cmp.cover;
    expect(a).toMatch(/^linear-gradient\(140deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
    expect(cmp.cover).toBe(a);
  });

  it('available: shows Borrow and emits borrow with the book', () => {
    const b = book();
    render({ book: b });
    const spy = jest.fn();
    cmp.borrow.subscribe(spy);
    expect(el().textContent).toContain('Available');
    buttons()[0].click();
    expect(spy).toHaveBeenCalledWith(b);
  });

  it('available + loading disables the Borrow button', () => {
    render({ book: book(), loading: true });
    expect(buttons()[0].disabled).toBe(true);
  });

  it('on loan with no reservation: shows Reserve and emits reserve', () => {
    const b = book({ available: false });
    render({ book: b });
    const spy = jest.fn();
    cmp.reserve.subscribe(spy);
    expect(el().textContent).toContain('On loan');
    expect(buttons()[0].textContent).toContain('Reserve');
    buttons()[0].click();
    expect(spy).toHaveBeenCalledWith(b);
  });

  it('on loan while reserving shows a busy, disabled button', () => {
    render({ book: book({ available: false }), reserving: true });
    expect(buttons()[0].textContent).toContain('Reserving…');
    expect(buttons()[0].disabled).toBe(true);
  });

  it('on loan and queued: shows the queue position and no buttons', () => {
    render({ book: book({ available: false }), queuePos: 3, queueStatus: 'waiting' });
    expect(el().textContent).toContain('In queue · #3');
    expect(buttons()).toHaveLength(0);
  });

  it("queueStatus 'ready' on an unavailable book offers Borrow now", () => {
    render({ book: book({ available: false }), queuePos: 1, queueStatus: 'ready' });
    expect(el().textContent).toContain('Ready for you');
    expect(buttons()[0].textContent).toContain('Borrow now');
  });
});
