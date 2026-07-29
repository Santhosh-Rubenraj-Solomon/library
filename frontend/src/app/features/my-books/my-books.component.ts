import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/notification.service';
import { Lend, Reservation } from '../../models';

@Component({
  selector: 'app-my-books',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="container page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Your shelf</p>
          <h1>My books</h1>
          <p>Books you're holding right now, and everything you've returned.</p>
        </div>
        <button class="btn ghost sm" (click)="reload()" [disabled]="loading()">Refresh</button>
      </div>

      @if (loading()) {
        <div class="state"><span class="spinner"></span><p>Loading your shelf…</p></div>
      } @else {
        <!-- currently borrowed -->
        <section class="block">
          <h2 class="block-title">Currently borrowed</h2>
          @if (borrowed().length === 0) {
            <div class="state card pad">
              <div class="glyph">📚</div>
              <h3>Nothing on loan</h3>
              <p>Head to the <a href="/catalog">catalog</a> to borrow a book.</p>
            </div>
          } @else {
            <div class="grid loans">
              @for (lend of borrowed(); track lend.lendId) {
                <div class="card pad loan">
                  <div class="loan-main">
                    <h3>{{ lend.bookName }}</h3>
                    <p class="muted">Borrowed {{ lend.lendDate | date: 'mediumDate' }}</p>
                    @if (lend.dueDate) {
                      <p class="due" [class.overdue]="isOverdue(lend.dueDate)">
                        {{ isOverdue(lend.dueDate) ? 'Overdue · was due ' : 'Due ' }}{{ lend.dueDate | date: 'mediumDate' }}
                      </p>
                    }
                  </div>
                  <button
                    class="btn accent sm"
                    [disabled]="returningName() === lend.bookName"
                    (click)="returnBook(lend.bookName)"
                  >
                    {{ returningName() === lend.bookName ? 'Returning…' : 'Return' }}
                  </button>
                </div>
              }
            </div>
          }
        </section>

        <!-- waitlist -->
        <section class="block">
          <h2 class="block-title">Your waitlist</h2>
          @if (reservations().length === 0) {
            <div class="state card pad">
              <div class="glyph">⏳</div>
              <h3>No reservations</h3>
              <p>Reserve an on-loan book from the <a href="/catalog">catalog</a> to queue for it.</p>
            </div>
          } @else {
            <div class="grid loans">
              @for (r of reservations(); track r.reservationId) {
                <div class="card pad loan">
                  <div class="loan-main">
                    <h3>{{ r.bookName }}</h3>
                    @if (r.status === 'ready') {
                      <p class="ready">Ready for you — borrow it now</p>
                    } @else {
                      <p class="muted">
                        #{{ r.position }} in queue@if (r.dueDate) { · due back {{ r.dueDate | date: 'mediumDate' }} }
                      </p>
                    }
                  </div>
                  <div class="res-actions">
                    @if (r.status === 'ready') {
                      <button class="btn sm" [disabled]="busyRes() === r.bookName" (click)="borrowReserved(r.bookName)">
                        {{ busyRes() === r.bookName ? '…' : 'Borrow' }}
                      </button>
                    }
                    <button class="btn ghost sm" [disabled]="busyRes() === r.bookName" (click)="cancelRes(r.bookName)">
                      Cancel
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- history -->
        <section class="block">
          <h2 class="block-title">Return history</h2>
          @if (history().length === 0) {
            <div class="state card pad">
              <div class="glyph">🗂️</div>
              <h3>No returns yet</h3>
              <p>Books you return will show up here.</p>
            </div>
          } @else {
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrowed</th>
                    <th>Returned</th>
                  </tr>
                </thead>
                <tbody>
                  @for (lend of history(); track lend.lendId) {
                    <tr>
                      <td>{{ lend.bookName }}</td>
                      <td class="mono">{{ lend.lendDate | date: 'mediumDate' }}</td>
                      <td class="mono">{{ lend.returnDate | date: 'mediumDate' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .block { margin-bottom: 34px; }
      .block-title { font-size: 1.25rem; margin-bottom: 14px; }
      .grid.loans { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
      .loan { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .loan-main h3 { font-size: 1.1rem; margin-bottom: 4px; }
      .loan-main p { margin: 0; font-size: 0.85rem; }
      .due { margin-top: 4px !important; font-weight: 500; color: var(--sl-primary-strong); }
      .due.overdue { color: var(--sl-danger); }
      .ready { color: var(--sl-success); font-weight: 600; }
      .res-actions { display: flex; gap: 8px; }
    `,
  ],
})
export class MyBooksComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly borrowed = signal<Lend[]>([]);
  readonly history = signal<Lend[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly returningName = signal<string | null>(null);
  readonly busyRes = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    let pending = 3;
    const done = () => {
      pending -= 1;
      if (pending === 0) this.loading.set(false);
    };

    this.api.getLendedBooksByUser().subscribe({
      next: (res) => {
        // Endpoint uses findOne → single record (or ERROR when none).
        const data = res.status === 'SUCCESS' ? res.data : null;
        this.borrowed.set(data ? (Array.isArray(data) ? data : [data]) : []);
        done();
      },
      error: () => {
        this.borrowed.set([]);
        done();
      },
    });

    this.api.getBooksReturnedByUser().subscribe({
      next: (res) => {
        this.history.set(res.status === 'SUCCESS' ? res.data ?? [] : []);
        done();
      },
      error: () => {
        this.history.set([]);
        done();
      },
    });

    this.api.getMyReservations().subscribe({
      next: (res) => {
        this.reservations.set(res.status === 'SUCCESS' ? res.data ?? [] : []);
        done();
      },
      error: () => {
        this.reservations.set([]);
        done();
      },
    });
  }

  returnBook(bookName: string): void {
    this.returningName.set(bookName);
    this.api.returnBook(bookName).subscribe({
      next: (res) => {
        this.returningName.set(null);
        if (res.status === 'SUCCESS') {
          this.notify.success(`Returned "${bookName}"`);
          this.reload();
        } else {
          this.notify.error(res.message || 'Could not return this book.');
        }
      },
      error: () => {
        this.returningName.set(null);
        this.notify.error('Could not return this book.');
      },
    });
  }

  isOverdue(dueDate: string | null | undefined): boolean {
    return !!dueDate && new Date(dueDate).getTime() < Date.now();
  }

  cancelRes(bookName: string): void {
    this.busyRes.set(bookName);
    this.api.cancelReservation(bookName).subscribe({
      next: (res) => {
        this.busyRes.set(null);
        if (res.status === 'SUCCESS') {
          this.notify.success(`Left the queue for "${bookName}"`);
          this.reload();
        } else {
          this.notify.error(res.message || 'Could not cancel the reservation.');
        }
      },
      error: () => {
        this.busyRes.set(null);
        this.notify.error('Could not cancel the reservation.');
      },
    });
  }

  borrowReserved(bookName: string): void {
    this.busyRes.set(bookName);
    const today = new Date().toISOString().slice(0, 10);
    this.api.lendBook(bookName, today).subscribe({
      next: (res) => {
        this.busyRes.set(null);
        if (res.status === 'SUCCESS') {
          this.notify.success(`Borrowed "${bookName}"`);
          this.reload();
        } else {
          this.notify.error(res.message || 'Could not borrow this book.');
        }
      },
      error: () => {
        this.busyRes.set(null);
        this.notify.error('Could not borrow this book.');
      },
    });
  }
}
