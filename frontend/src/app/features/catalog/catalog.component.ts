import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/notification.service';
import { BookCardComponent } from '../../shared/book-card/book-card.component';
import { Book, BookQuery, Reservation } from '../../models';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [FormsModule, BookCardComponent],
  template: `
    <div class="container page">
      <section class="hero">
        <button class="btn ghost sm hero-refresh" (click)="reload()" [disabled]="loading()">Refresh</button>
        <img class="hero-mark" src="assets/surfboard-logo.png" alt="" aria-hidden="true" />
        <div class="hero-body">
          <p class="eyebrow">The shelves</p>
          <h1>Find your next read.</h1>
          <p class="lede">Browse the community shelves, borrow in a tap, and see what's out on loan — in real time.</p>
          <div class="stats">
            <div class="stat">
              <span class="num">{{ dTotal() }}</span>
              <span class="lbl">on the shelves</span>
            </div>
            <div class="stat">
              <span class="num ok">{{ dAvail() }}</span>
              <span class="lbl">available now</span>
            </div>
            <div class="stat">
              <span class="num">{{ dLoan() }}</span>
              <span class="lbl">out on loan</span>
            </div>
          </div>
        </div>
        <div class="waves" aria-hidden="true">
          <svg class="wv wv1" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0 30 q 90 -18 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 L1440 60 L0 60 Z" /></svg>
          <svg class="wv wv2" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0 30 q 90 -18 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 L1440 60 L0 60 Z" /></svg>
          <svg class="wv wv3" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0 30 q 90 -18 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 L1440 60 L0 60 Z" /></svg>
        </div>
      </section>

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
        <div class="grid cards">
          @for (s of skeletons; track $index) {
            <div class="skeleton-card card">
              <div class="sk-cover shimmer"></div>
              <div class="sk-body">
                <div class="sk-line shimmer w70"></div>
                <div class="sk-line shimmer w40"></div>
                <div class="sk-chips">
                  <span class="sk-chip shimmer"></span><span class="sk-chip shimmer"></span>
                </div>
                <div class="sk-foot">
                  <span class="sk-pill shimmer"></span><span class="sk-btn shimmer"></span>
                </div>
              </div>
            </div>
          }
        </div>
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
          @for (book of visible(); track book.bookId; let i = $index) {
            <app-book-card
              [book]="book"
              [index]="i"
              [loading]="lendingName() === book.bookName"
              [queuePos]="resMap().get(book.bookName)?.position ?? null"
              [queueStatus]="resMap().get(book.bookName)?.status ?? null"
              [reserving]="reservingName() === book.bookName"
              (borrow)="borrow($event)"
              (reserve)="reserve($event)"
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

      /* ---- hero (bold blue focal block) ---- */
      .hero {
        position: relative;
        overflow: hidden;
        border-radius: var(--sl-radius-lg);
        background:
          radial-gradient(130% 150% at 88% -30%, rgba(10, 163, 154, 0.55), transparent 55%),
          linear-gradient(135deg, #1650ff 0%, #0e3fd0 45%, #0a2ba6 100%);
        padding: 42px 34px 78px;
        margin-bottom: 26px;
        box-shadow: 0 22px 55px -22px rgba(14, 68, 225, 0.6);
      }
      .hero-body { position: relative; z-index: 2; }
      .hero .eyebrow { color: rgba(255, 255, 255, 0.75); }
      .hero h1 {
        margin: 8px 0 0;
        font-size: clamp(2.1rem, 4.8vw, 3rem);
        letter-spacing: -0.025em;
        color: #fff;
      }
      .hero .lede {
        margin: 12px 0 0;
        max-width: 46ch;
        color: rgba(255, 255, 255, 0.82);
        font-size: 1.02rem;
      }
      .hero-refresh {
        position: absolute;
        top: 18px;
        right: 18px;
        z-index: 3;
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.4);
        color: #fff;
      }
      .hero-refresh:hover {
        background: rgba(255, 255, 255, 0.24);
        border-color: rgba(255, 255, 255, 0.6);
      }
      .hero-mark {
        position: absolute;
        right: -14px;
        bottom: 4px;
        width: 230px;
        height: auto;
        z-index: 1;
        opacity: 0.14;
        filter: brightness(0) invert(1);
        pointer-events: none;
      }
      .stats { margin-top: 26px; display: flex; gap: 34px; flex-wrap: wrap; }
      .stat .num {
        font-family: var(--sl-font-display);
        font-size: 2.15rem;
        font-weight: 700;
        line-height: 1;
        color: #fff;
        font-variant-numeric: tabular-nums;
      }
      .stat .num.ok { color: #7ef0c8; }
      .stat .lbl {
        display: block;
        margin-top: 5px;
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.66);
      }
      .waves { position: absolute; left: 0; right: 0; bottom: 0; height: 64px; overflow: hidden; pointer-events: none; }
      .wv { position: absolute; left: 0; bottom: 0; width: 200%; display: block; will-change: transform; }
      .wv1 { height: 64px; }
      .wv1 path { fill: rgba(255, 255, 255, 0.14); }
      .wv2 { height: 52px; }
      .wv2 path { fill: rgba(255, 255, 255, 0.28); }
      .wv3 { height: 42px; }
      .wv3 path { fill: #e7eefb; }

      /* ---- loading skeletons ---- */
      .skeleton-card { overflow: hidden; }
      .sk-cover { height: 132px; }
      .sk-body { padding: 16px; display: flex; flex-direction: column; gap: 11px; }
      .sk-line { height: 12px; border-radius: 6px; }
      .sk-line.w70 { width: 70%; }
      .sk-line.w40 { width: 42%; }
      .sk-chips { display: flex; gap: 6px; margin-top: 2px; }
      .sk-chip { width: 54px; height: 18px; border-radius: 999px; }
      .sk-foot { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; }
      .sk-pill { width: 82px; height: 22px; border-radius: 999px; }
      .sk-btn { width: 72px; height: 30px; border-radius: 8px; }
      .shimmer {
        background: linear-gradient(100deg, var(--sl-surface-sunk) 30%, #eef1f6 50%, var(--sl-surface-sunk) 70%);
        background-size: 200% 100%;
      }

      @media (prefers-reduced-motion: no-preference) {
        .shimmer { animation: shimmer 1.3s linear infinite; }
        .wv { animation: waveScroll linear infinite; }
        .wv1 { animation-duration: 18s; animation-direction: reverse; }
        .wv2 { animation-duration: 12s; }
        .wv3 { animation-duration: 8s; animation-direction: reverse; }
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        /* seamless: width is 200% and the wave period divides the shift, so
           translating exactly one container-width loops with no visible seam. */
        @keyframes waveScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      }

      @media (max-width: 640px) {
        .hero { padding: 24px 20px 54px; }
        .hero-refresh { display: none; }
        .stats { gap: 22px; }
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
  readonly reservingName = signal<string | null>(null);
  readonly reservations = signal<Reservation[]>([]);
  readonly resMap = computed(() => {
    const m = new Map<string, Reservation>();
    for (const r of this.reservations()) m.set(r.bookName, r);
    return m;
  });

  readonly q = signal('');
  readonly genreFilter = signal('');
  readonly availableOnly = signal(false);
  readonly advancedOpen = signal(false);
  readonly serverResult = signal(false);

  // animated hero counters
  readonly dTotal = signal(0);
  readonly dAvail = signal(0);
  readonly dLoan = signal(0);
  readonly skeletons = Array.from({ length: 8 });

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

  private tween(target: number, set: (n: number) => void): void {
    if (typeof requestAnimationFrame === 'undefined' || target <= 0) {
      set(target);
      return;
    }
    const dur = 700;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      set(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private animateCounts(): void {
    const total = this.allBooks().length;
    const avail = this.allBooks().filter((b) => b.available).length;
    this.tween(total, (n) => this.dTotal.set(n));
    this.tween(avail, (n) => this.dAvail.set(n));
    this.tween(total - avail, (n) => this.dLoan.set(n));
  }

  ngOnInit(): void {
    this.reload();
    this.loadReservations();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.serverResult.set(false);
    this.api.getAllBooks().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.allBooks.set(res.status === 'SUCCESS' ? res.data ?? [] : []);
        this.animateCounts();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('The API did not respond. Please try again in a moment.');
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
          this.loadReservations();
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

  loadReservations(): void {
    if (!this.auth.isLoggedIn()) {
      this.reservations.set([]);
      return;
    }
    this.api.getMyReservations().subscribe({
      next: (res) => this.reservations.set(res.status === 'SUCCESS' ? res.data ?? [] : []),
      error: () => this.reservations.set([]),
    });
  }

  reserve(book: Book): void {
    if (!this.auth.isLoggedIn()) {
      this.promptSignin();
      return;
    }
    this.reservingName.set(book.bookName);
    this.api.reserveBook(book.bookName).subscribe({
      next: (res) => {
        this.reservingName.set(null);
        if (res.status === 'SUCCESS') {
          this.notify.success(res.message || `Reserved "${book.bookName}"`);
          this.loadReservations();
        } else {
          this.notify.error(res.message || 'Could not reserve this book.');
        }
      },
      error: () => {
        this.reservingName.set(null);
        this.notify.error('Could not reserve this book.');
      },
    });
  }

  private promptSignin(): void {
    this.notify.info('Please sign in first.');
    this.router.navigate(['/signin'], { queryParams: { redirect: '/catalog' } });
  }
}
