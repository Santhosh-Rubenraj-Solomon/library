import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Book } from '../../models';

/** Catalog tile. No cover images exist, so we render a deterministic "spine". */
@Component({
  selector: 'app-book-card',
  standalone: true,
  template: `
    <article class="book-card card">
      <div class="cover" [style.background]="cover">
        <span class="spine"></span>
        <span class="initials">{{ initials }}</span>
        <span class="lang">{{ book.language }}</span>
      </div>
      <div class="bc-body">
        <h3 [title]="book.bookName">{{ book.bookName }}</h3>
        <p class="author">{{ book.authorName }}</p>
        <div class="meta">
          <span class="badge role">{{ book.genre }}</span>
          <span class="badge muted-badge">Donated · {{ book.donatedBy }}</span>
        </div>
        <div class="bc-foot">
          @if (book.available) {
            <span class="badge ok"><span class="dot"></span> Available</span>
          } @else {
            <span class="badge out"><span class="dot"></span> On loan</span>
          }
          <button
            class="btn sm"
            [disabled]="!book.available || loading"
            (click)="borrow.emit(book)"
          >
            {{ book.available ? 'Borrow' : 'Unavailable' }}
          </button>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .book-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: transform 0.12s ease, box-shadow 0.18s ease;
      }
      .book-card:hover { transform: translateY(-3px); box-shadow: var(--sl-shadow); }
      .cover {
        position: relative;
        height: 132px;
        display: grid;
        place-items: center;
        color: #fff;
      }
      .cover .spine {
        position: absolute;
        left: 14px;
        top: 0;
        bottom: 0;
        width: 6px;
        background: rgba(255, 255, 255, 0.25);
      }
      .cover .initials {
        font-family: var(--sl-font-display);
        font-size: 2.1rem;
        font-weight: 700;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      }
      .cover .lang {
        position: absolute;
        right: 10px;
        bottom: 8px;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.85;
      }
      .bc-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .bc-body h3 {
        font-size: 1.05rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .author { margin: 0; color: var(--sl-muted); font-size: 0.88rem; }
      .meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
      .muted-badge {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bc-foot {
        margin-top: auto;
        padding-top: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
    `,
  ],
})
export class BookCardComponent {
  @Input({ required: true }) book!: Book;
  @Input() loading = false;
  @Output() borrow = new EventEmitter<Book>();

  private static readonly PALETTE = [
    ['#0e7490', '#0b5563'],
    ['#e2603b', '#b8442a'],
    ['#2f7a55', '#1f5a3d'],
    ['#5b6bb5', '#3c4a8f'],
    ['#b7791f', '#8a5a12'],
    ['#8a4d9e', '#653877'],
  ];

  get initials(): string {
    const words = (this.book?.bookName ?? '?').trim().split(/\s+/);
    const letters = words.slice(0, 2).map((w) => w.charAt(0).toUpperCase());
    return letters.join('') || '?';
  }

  get cover(): string {
    const key = `${this.book?.bookName ?? ''}${this.book?.genre ?? ''}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    const [a, b] = BookCardComponent.PALETTE[hash % BookCardComponent.PALETTE.length];
    return `linear-gradient(140deg, ${a}, ${b})`;
  }
}
