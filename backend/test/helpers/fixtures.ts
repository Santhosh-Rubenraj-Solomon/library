import { fakeDb } from "./fake-db";

export const bookInput = (overrides: Record<string, any> = {}) => ({
  bookName: "Dune",
  authorName: "Frank Herbert",
  language: "English",
  genre: "Sci-Fi",
  donatedBy: "Alice",
  ...overrides,
});

export const seedBook = (overrides: Record<string, any> = {}) => fakeDb.library.seed(bookInput(overrides));
