import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/notification.service';
import { BookCardComponent } from '../../shared/book-card/book-card.component';
import { Book, BookQuery } from '../../models';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [FormsModule, BookCardComponent],
  template: `
    <div class="container page">
      <div class="page-head">
        <div>
          <p class="eyebrow">The shelves</p>
          <h1>Catalog</h1>
          <p>Browse everything on the shelves. Sign in to borrow, return, and search precisely.</p>
        </div>
        <button class="btn ghost sm" (click)="reload()" [disabled]="loading()">Refresh</button>
      </div>

      <!-- instant client-side filter -->
      <div class="card pad filters">
        <div class="filter-row">
          <div class="field grow">
            <label for="q">Filter the shelves</label>
            <input
              id="q"
              class="input"
              type="search"
              placeholder="Title, author, genre or donor…"
              [ngModel]="q()"
              (ngModelChange)="q.set($event)"
            />
          </div>
          <div class="field">
            <label for="genre">Genre</label>
            <select id="genre" class="input" [ngModel]="genreFilter()" (ngModelChange)="genreFilter.set($event)">
              <option value="">All genres</option>
              @for (g of genres(); track g) {
                <option [value]="g">{{ g }}</option>
              }
            </select>
          </div>
          <label class="check">
            <input
              type="checkbox"
              [ngModel]="availableOnly()"
              (ngModelChange)="availableOnly.set($event)"
            />
            Available only
          </label>
          <button class="btn ghost sm advanced-toggle" (click)="advancedOpen.set(!advancedOpen())">
            {{ advancedOpen() ? 'Hide' : 'Precise search' }}
          </button>
        </div>

        <!-- server-backed exact search → GET /getbookbyquery -->
        @if (advancedOpen()) {
          <div class="advanced">
            <p class="muted note">
              Exact-match query against <code>/getbookbyquery</code> (requires sign in). Leave
              fields blank to ignore them.
            </p>
            <div class="form-grid">
              <div class="field">
                <label>Book name</label>
                <input class="input" [(ngModel)]="adv.bookName" />
              </div>
              <div class="field">
                <label>Author</label>
                <input class="input" [(ngModel)]="adv.authorName" />
              </div>
              <div class="field">
                <label>Language</label>
                <input class="input" [(ngModel)]="adv.language" />
              </div>
              <div class="field">
                <label>Genre</label>
                <input class="input" [(ngModel)]="adv.genre" />
              </div>
              <div class="field">
                <label>Donated by</label>
                <input class="input" [(ngModel)]="adv.donatedBy" />
              </div>
            </div>
            <div class="row">
              <button class="btn sm" (click)="runServerSearch()" [disabled]="loading()">Search server</button>
              <button class="btn ghost sm" (click)="reload()">Reset to all</button>
              @if (serverResult()) {
                <span class="muted">Showing server results.</span>
              }
            </div>
          </div>
        }
      </div>

      <!-- results -->
      @if (loading()) {
        <div class="state"><span class="spinner"></span><p>Loading the catalog…</p></div>
      } @else if (error()) {
        <div class="state error card pad">
          <div class="glyph">⚠️</div>
          <h3>Couldn't load the catalog</h3>
          <p>{{ error() }}</p>
          <button class="btn sm" (click)="reload()">Try again</button>
        </div>
      } @else if (visible().length === 0) {
        <div class="state">
          <div class="glyph">🏝️</div>
          <h3>No books match</h3>
          <p>Try clearing the filters or refreshing the shelves.</p>
        </div>
      } @else {
        <p class="count muted">{{ visible().length }} book{{ visible().length === 1 ? '' : 's' }}</p>
        <div class="grid cards">
          @for (book of visible(); track book.bookId) {
            <app-book-card
              [book]="book"
              [loading]="lendingName() === book.bookName"
              (borrow)="borrow($event)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .filters { margin-bottom: 24px; }
      .filter-row { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
      .grow { flex: 1; min-width: 220px; }
      .check {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        color: var(--sl-muted);
        padding-bottom: 11px;
        white-space: nowrap;
      }
      .advanced-toggle { margin-bottom: 1px; }
      .advanced { margin-top: 18px; padding-top: 18px; border-top: 1px dashed var(--sl-border); }
      .advanced .note { margin: 0 0 14px; font-size: 0.85rem; }
      .advanced .row { margin-top: 14px; flex-wrap: wrap; }
      .count { margin: 0 0 14px; font-size: 0.88rem; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        background: var(--sl-surface-sunk);
        padding: 1px 5px;
        border-radius: 5px;
        font-size: 0.85em;
      }
    `,
  ],
})
export class CatalogComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  readonly allBooks = signal<Book[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lendingName = signal<string | null>(null);

  readonly q = signal('');
  readonly genreFilter = signal('');
  readonly availableOnly = signal(false);
  readonly advancedOpen = signal(false);
  readonly serverResult = signal(false);

  adv: BookQuery = { bookName: '', authorName: '', language: '', genre: '', donatedBy: '' };

  readonly genres = computed(() =>
    [...new Set(this.allBooks().map((b) => b.genre).filter(Boolean))].sort(),
  );

  readonly visible = computed(() => {
    const term = this.q().trim().toLowerCase();
    const genre = this.genreFilter();
    const availableOnly = this.availableOnly();
    return this.allBooks().filter((b) => {
      if (availableOnly && !b.available) return false;
      if (genre && b.genre !== genre) return false;
      if (!term) return true;
      return [b.bookName, b.authorName, b.genre, b.donatedBy, b.language]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(term));
    });
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.serverResult.set(false);
    this.api.getAllBooks().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.status === 'SUCCESS') {
          this.allBooks.set(res.data ?? []);
        } else {
          // "No books" is a handled empty state, not a hard error.
          this.allBooks.set([]);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('The API did not respond. Is the stack running on :8080?');
      },
    });
  }

  runServerSearch(): void {
    if (!this.auth.isLoggedIn()) {
      this.promptSignin();
      return;
    }
    const query: BookQuery = {};
    (Object.keys(this.adv) as (keyof BookQuery)[]).forEach((k) => {
      const v = (this.adv[k] ?? '').trim();
      if (v) query[k] = v;
    });
    if (Object.keys(query).length === 0) {
      this.notify.info('Enter at least one field to search.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getBookByQuery(query).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.serverResult.set(true);
        if (res.status === 'SUCCESS') {
          this.allBooks.set(res.data ?? []);
        } else {
          this.allBooks.set([]);
          this.notify.info(res.message || 'No matches found.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Search failed. Please try again.');
      },
    });
  }

  borrow(book: Book): void {
    if (!this.auth.isLoggedIn()) {
      this.promptSignin();
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    this.lendingName.set(book.bookName);
    this.api.lendBook(book.bookName, today).subscribe({
      next: (res) => {
        this.lendingName.set(null);
        if (res.status === 'SUCCESS') {
          this.notify.success(`Borrowed "${book.bookName}"`);
          this.markUnavailable(book.bookName);
        } else {
          this.notify.error(res.message || 'Could not borrow this book.');
        }
      },
      error: () => {
        this.lendingName.set(null);
        this.notify.error('Could not borrow this book.');
      },
    });
  }

  private markUnavailable(bookName: string): void {
    this.allBooks.update((books) =>
      books.map((b) => (b.bookName === bookName ? { ...b, available: false } : b)),
    );
  }

  private promptSignin(): void {
    this.notify.info('Please sign in first.');
    this.router.navigate(['/signin'], { queryParams: { redirect: '/catalog' } });
  }
}
