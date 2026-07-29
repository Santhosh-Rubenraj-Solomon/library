import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/notification.service';
import { Book, BookInput, Lend, User } from '../../models';

type Tab = 'books' | 'users' | 'lending';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="container page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Back office</p>
          <h1>Admin console</h1>
          <p>Manage the catalog, see who's registered, and track every loan.</p>
        </div>
        <div class="tabs">
          <button [class.active]="tab() === 'books'" (click)="switch('books')">Books</button>
          <button [class.active]="tab() === 'users'" (click)="switch('users')">Members</button>
          <button [class.active]="tab() === 'lending'" (click)="switch('lending')">Lending</button>
        </div>
      </div>

      <!-- ========================================================= BOOKS -->
      @if (tab() === 'books') {
        <section class="split">
          <form class="card pad book-form" (ngSubmit)="saveBook()">
            <h2>{{ editing() ? 'Edit book' : 'Add a book' }}</h2>
            <p class="muted sub">
              {{ editing() ? 'Updating by book name — the name itself is fixed.' : 'All fields are required.' }}
            </p>
            <div class="field">
              <label>Book name</label>
              <input class="input" [(ngModel)]="form.bookName" name="bookName" [readonly]="editing()" />
            </div>
            <div class="field">
              <label>Author</label>
              <input class="input" [(ngModel)]="form.authorName" name="authorName" />
            </div>
            <div class="field">
              <label>Language</label>
              <input class="input" [(ngModel)]="form.language" name="language" />
            </div>
            <div class="field">
              <label>Genre</label>
              <input class="input" [(ngModel)]="form.genre" name="genre" />
            </div>
            <div class="field">
              <label>Donated by</label>
              <input class="input" [(ngModel)]="form.donatedBy" name="donatedBy" />
            </div>
            <div class="row">
              <button class="btn" type="submit" [disabled]="saving()">
                {{ saving() ? 'Saving…' : editing() ? 'Save changes' : 'Add book' }}
              </button>
              @if (editing()) {
                <button class="btn ghost" type="button" (click)="resetForm()">Cancel</button>
              }
            </div>
          </form>

          <div class="list-side">
            <div class="row list-head">
              <h2>Catalog</h2>
              <span class="spacer"></span>
              <button class="btn ghost sm" (click)="loadBooks()" [disabled]="loading()">Refresh</button>
            </div>
            @if (loading()) {
              <div class="state"><span class="spinner"></span></div>
            } @else if (books().length === 0) {
              <div class="state card pad"><div class="glyph">📕</div><h3>No books yet</h3></div>
            } @else {
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr><th>Book</th><th>Author</th><th>Genre</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (book of books(); track book.bookId) {
                      <tr>
                        <td>{{ book.bookName }}</td>
                        <td class="muted">{{ book.authorName }}</td>
                        <td><span class="badge role">{{ book.genre }}</span></td>
                        <td>
                          @if (book.available) {
                            <span class="badge ok"><span class="dot"></span> In</span>
                          } @else {
                            <span class="badge out"><span class="dot"></span> Out</span>
                          }
                        </td>
                        <td>
                          <div class="actions">
                            <button class="btn ghost sm" (click)="edit(book)">Edit</button>
                            <button class="btn danger sm" (click)="remove(book)">Delete</button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </section>
      }

      <!-- ========================================================= USERS -->
      @if (tab() === 'users') {
        <div class="row list-head" style="margin-bottom: 12px;">
          <div>
            <h2>Members</h2>
            <p class="muted sub" style="margin: 2px 0 0; font-size: 0.88rem;">
              Promote a member to admin to let them manage the catalog and other admins.
            </p>
          </div>
          <span class="spacer"></span>
          <button class="btn ghost sm" (click)="loadUsers()" [disabled]="loading()">Refresh</button>
        </div>
        @if (loading()) {
          <div class="state"><span class="spinner"></span></div>
        } @else if (users().length === 0) {
          <div class="state card pad"><div class="glyph">👤</div><h3>No members registered</h3></div>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Email</th><th>Role</th><th>Visits</th><th>Joined</th><th></th></tr>
              </thead>
              <tbody>
                @for (user of users(); track user.userId) {
                  <tr>
                    <td>
                      {{ user.mailId }}
                      @if (user.mailId === auth.user()?.mailId) { <span class="badge">you</span> }
                    </td>
                    <td>
                      <span class="badge" [class.role]="user.role === 'admin'">{{ user.role }}</span>
                    </td>
                    <td class="mono">{{ user.visitCount ?? 0 }}</td>
                    <td class="mono">{{ user.createdAt | date: 'mediumDate' }}</td>
                    <td>
                      @if (user.role === 'admin') {
                        <button
                          class="btn ghost sm"
                          (click)="setRole(user, 'user')"
                          [disabled]="busy() === user.mailId || user.mailId === SUPER || user.mailId === auth.user()?.mailId"
                          [title]="user.mailId === SUPER ? 'The primary admin cannot be demoted' : ''"
                        >
                          {{ busy() === user.mailId ? '…' : 'Remove admin' }}
                        </button>
                      } @else {
                        <button class="btn sm" (click)="setRole(user, 'admin')" [disabled]="busy() === user.mailId">
                          {{ busy() === user.mailId ? '…' : 'Make admin' }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- ======================================================= LENDING -->
      @if (tab() === 'lending') {
        @if (loading()) {
          <div class="state"><span class="spinner"></span></div>
        } @else {
          <section class="block">
            <h2 class="block-title">Currently lent ({{ lent().length }})</h2>
            @if (lent().length === 0) {
              <div class="state card pad"><div class="glyph">📗</div><h3>Nothing is out on loan</h3></div>
            } @else {
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Book</th><th>Borrower</th><th>Lent on</th></tr></thead>
                  <tbody>
                    @for (l of lent(); track l.lendId) {
                      <tr>
                        <td>{{ l.bookName }}</td>
                        <td class="muted">{{ l.mailId }}</td>
                        <td class="mono">{{ l.lendDate | date: 'mediumDate' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <section class="block">
            <h2 class="block-title">Returned ({{ returned().length }})</h2>
            @if (returned().length === 0) {
              <div class="state card pad"><div class="glyph">📘</div><h3>No returns recorded</h3></div>
            } @else {
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Book</th><th>Borrower</th><th>Lent</th><th>Returned</th></tr></thead>
                  <tbody>
                    @for (l of returned(); track l.lendId) {
                      <tr>
                        <td>{{ l.bookName }}</td>
                        <td class="muted">{{ l.mailId }}</td>
                        <td class="mono">{{ l.lendDate | date: 'mediumDate' }}</td>
                        <td class="mono">{{ l.returnDate | date: 'mediumDate' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }
      }
    </div>
  `,
  styles: [
    `
      .tabs { align-self: center; }
      .split { display: grid; grid-template-columns: 340px 1fr; gap: 24px; align-items: start; }
      .book-form { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 90px; }
      .book-form h2 { font-size: 1.3rem; }
      .book-form .sub { margin: -8px 0 2px; font-size: 0.85rem; }
      .book-form input[readonly] { background: var(--sl-surface-sunk); color: var(--sl-muted); }
      .list-side { min-width: 0; }
      .list-head { margin-bottom: 12px; }
      .list-head h2 { font-size: 1.3rem; }
      .block { margin-bottom: 34px; }
      .block-title { font-size: 1.2rem; margin-bottom: 14px; }
      @media (max-width: 900px) {
        .split { grid-template-columns: 1fr; }
        .book-form { position: static; }
      }
    `,
  ],
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly auth = inject(AuthService);

  /** The primary admin — protected from demotion in the UI and the API. */
  readonly SUPER = 'santhoshrubenc@gmail.com';
  readonly busy = signal<string | null>(null);

  readonly tab = signal<Tab>('books');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal(false);

  readonly books = signal<Book[]>([]);
  readonly users = signal<User[]>([]);
  readonly lent = signal<Lend[]>([]);
  readonly returned = signal<Lend[]>([]);

  form: BookInput = { bookName: '', authorName: '', language: '', genre: '', donatedBy: '' };

  ngOnInit(): void {
    this.loadBooks();
  }

  switch(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'books') this.loadBooks();
    if (tab === 'users') this.loadUsers();
    if (tab === 'lending') this.loadLending();
  }

  // --- books ----------------------------------------------------------------
  loadBooks(): void {
    this.loading.set(true);
    this.api.getAllBooks().subscribe({
      next: (res) => {
        this.books.set(res.status === 'SUCCESS' ? res.data ?? [] : []);
        this.loading.set(false);
      },
      error: () => {
        this.books.set([]);
        this.loading.set(false);
        this.notify.error('Could not load books.');
      },
    });
  }

  edit(book: Book): void {
    this.editing.set(true);
    this.form = {
      bookName: book.bookName,
      authorName: book.authorName,
      language: book.language,
      genre: book.genre,
      donatedBy: book.donatedBy,
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.editing.set(false);
    this.form = { bookName: '', authorName: '', language: '', genre: '', donatedBy: '' };
  }

  private isFilled(): boolean {
    return (Object.values(this.form) as string[]).every((v) => v.trim().length > 0);
  }

  saveBook(): void {
    if (!this.isFilled()) {
      this.notify.error('All fields are required.');
      return;
    }
    this.saving.set(true);
    const request = this.editing() ? this.api.updateBook(this.form) : this.api.postNewBook(this.form);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.status === 'SUCCESS') {
          this.notify.success(res.message || (this.editing() ? 'Book updated' : 'Book added'));
          this.resetForm();
          this.loadBooks();
        } else {
          this.notify.error(res.message || 'Could not save the book.');
        }
      },
      error: () => {
        this.saving.set(false);
        this.notify.error('Could not save the book.');
      },
    });
  }

  remove(book: Book): void {
    if (!confirm(`Delete "${book.bookName}"? This cannot be undone.`)) return;
    this.api.deleteBook(book.bookName).subscribe({
      next: (res) => {
        if (res.status === 'SUCCESS') {
          this.notify.success(res.message || 'Book deleted');
          this.books.update((list) => list.filter((b) => b.bookId !== book.bookId));
        } else {
          this.notify.error(res.message || 'Could not delete the book.');
        }
      },
      error: () => this.notify.error('Could not delete the book.'),
    });
  }

  // --- users ----------------------------------------------------------------
  loadUsers(): void {
    this.loading.set(true);
    this.api.getUsers().subscribe({
      next: (res) => {
        this.users.set(res.status === 'SUCCESS' ? res.data ?? [] : []);
        this.loading.set(false);
      },
      error: () => {
        this.users.set([]);
        this.loading.set(false);
        this.notify.error('Could not load members.');
      },
    });
  }

  setRole(user: User, role: 'admin' | 'user'): void {
    this.busy.set(user.mailId);
    this.api.setRole(user.mailId, role).subscribe({
      next: (res) => {
        this.busy.set(null);
        if (res.status === 'SUCCESS') {
          this.notify.success(res.message || `${user.mailId} is now ${role}`);
          this.users.update((list) =>
            list.map((u) => (u.mailId === user.mailId ? { ...u, role } : u)),
          );
        } else {
          this.notify.error(res.message || 'Could not change the role.');
        }
      },
      error: (err) => {
        this.busy.set(null);
        this.notify.error(err?.error?.message || 'Could not change the role.');
      },
    });
  }

  // --- lending --------------------------------------------------------------
  loadLending(): void {
    this.loading.set(true);
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) this.loading.set(false);
    };
    this.api.getLendedBooks().subscribe({
      next: (res) => {
        this.lent.set(res.status === 'SUCCESS' ? res.data ?? [] : []);
        done();
      },
      error: () => {
        this.lent.set([]);
        done();
      },
    });
    this.api.getReturnedBooks().subscribe({
      next: (res) => {
        this.returned.set(res.status === 'SUCCESS' ? res.data ?? [] : []);
        done();
      },
      error: () => {
        this.returned.set([]);
        done();
      },
    });
  }
}
