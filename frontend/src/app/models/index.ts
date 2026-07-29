/** Shared response envelope — every endpoint returns this shape. */
export interface ApiResponse<T> {
  status: 'SUCCESS' | 'ERROR';
  data: T;
  message?: string;
}

/** Catalog book (entity/books.ts). */
export interface Book {
  bookId: string;
  bookName: string;
  authorName: string;
  language: string;
  genre: string;
  available: boolean;
  donatedBy: string;
  createdAt?: string;
  updatedAt?: string | null;
}

/** Registered user (entity/users.ts). */
export interface User {
  userId: string;
  mailId: string;
  role: string;
  createdAt?: string;
  visitCount?: number;
}

/** Lend record (entity/lends.ts) — also used for returned books. */
export interface Lend {
  lendId: string;
  userId: string;
  bookName: string;
  mailId: string;
  lendDate: string;
  returnDate: string | null;
  dueDate?: string | null;
  returned: boolean;
}

/** A spot in a book's waitlist (entity/reservations.ts). */
export interface Reservation {
  reservationId?: string;
  bookName: string;
  mailId?: string;
  status: 'waiting' | 'ready' | string;
  position?: number;
  createdAt?: string;
  dueDate?: string | null;
}

/** Decoded `user` claim carried inside the signin JWT. */
export interface TokenUser {
  userId: string;
  mailId: string;
  role: string;
}

/** Query accepted by /getbookbyquery — any subset. */
export interface BookQuery {
  bookName?: string;
  authorName?: string;
  language?: string;
  genre?: string;
  donatedBy?: string;
}

/** Body accepted by /postnewbook and /updatebook. */
export interface BookInput {
  bookName: string;
  authorName: string;
  language: string;
  genre: string;
  donatedBy: string;
}
