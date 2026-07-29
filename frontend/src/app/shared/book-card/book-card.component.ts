import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Book } from '../../models';

/** Catalog tile. No cover images exist, so we render a deterministic "spine". */
@Component({
  selector: 'app-book-card',
  standalone: true,
  template: `
    <article class="book-card card" [style.animation-delay.ms]="(index % 12) * 45">
      <div class="cover" [style.background]="cover">
        <span class="spine"></span>
        <span class="sheen"></span>
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
            <button class="btn sm" [disabled]="loading" (click)="borrow.emit(book)">Borrow</button>
          } @else if (queueStatus === 'ready') {
            <span class="badge ok"><span class="dot"></span> Ready for you</span>
            <button class="btn sm" [disabled]="loading" (click)="borrow.emit(book)">
              {{ loading ? 'Borrowing…' : 'Borrow now' }}
            </button>
          } @else if (queuePos) {
            <span class="badge out"><span class="dot"></span> On loan</span>
            <span class="badge role">In queue · #{{ queuePos }}</span>
          } @else {
            <span class="badge out"><span class="dot"></span> On loan</span>
            <button class="btn ghost sm" [disabled]="reserving" (click)="reserve.emit(book)">
              {{ reserving ? 'Reserving…' : 'Reserve' }}
            </button>
          }
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
        box-shadow: var(--sl-shadow-sm);
        transition: transform 0.16s ease, box-shadow 0.2s ease;
      }
      .book-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 42px -16px rgba(14, 68, 225, 0.42);
      }
      .book-card:hover .sheen {
        transform: translateX(320%) skewX(-18deg);
      }
      .cover {
        position: relative;
        height: 148px;
        display: grid;
        place-items: center;
        color: #fff;
        overflow: hidden;
      }
      .cover::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 42%, rgba(0, 0, 0, 0.16));
        pointer-events: none;
      }
      .cover .sheen {
        position: absolute;
        top: 0;
        bottom: 0;
        left: -60%;
        width: 45%;
        background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.38), transparent);
        transform: translateX(0) skewX(-18deg);
        transition: transform 0.6s ease;
        pointer-events: none;
      }
      @media (prefers-reduced-motion: no-preference) {
        .book-card {
          opacity: 0;
          animation: cardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes cardIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
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
  @Input() index = 0;
  @Input() queuePos: number | null = null;
  @Input() queueStatus: string | null = null;
  @Input() reserving = false;
  @Output() borrow = new EventEmitter<Book>();
  @Output() reserve = new EventEmitter<Book>();

  // Surfboard-toned spine gradients (blue / teal family).
  private static readonly PALETTE = [
    ['#0e44e1', '#0d33b8'], // royal blue
    ['#0aa39a', '#077a73'], // mint teal
    ['#3b82f6', '#1d4ed8'], // sky blue
    ['#6366f1', '#4338ca'], // indigo
    ['#0891b2', '#0e7490'], // cyan
    ['#5b6bb5', '#3c4a8f'], // slate blue
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
