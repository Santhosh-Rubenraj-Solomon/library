import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { getApp, auth, admin, alice } from "./helpers/app";
import { fakeDb } from "./helpers/fake-db";
import { bookInput, seedBook } from "./helpers/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await getApp();
});

const post = (payload: any) => app.inject({ method: "POST", url: "/postnewbook", headers: auth(admin), payload });
const put = (payload: any) => app.inject({ method: "PUT", url: "/updatebook", headers: auth(admin), payload });
const del = (qs: string) => app.inject({ method: "DELETE", url: `/deletebook${qs}`, headers: auth(admin) });
const query = (qs: string, user = alice) => app.inject({ method: "GET", url: `/getbookbyquery${qs}`, headers: auth(user) });

describe("POST /postnewbook (admin)", () => {
  it("adds a book, available by default", async () => {
    const res = await post(bookInput());
    const body = res.json();
    expect(body.status).toBe("SUCCESS");
    expect(body.message).toBe("Dune book added successfully");
    expect(body.data).toMatchObject({ ...bookInput(), bookId: expect.any(String) });
    expect(fakeDb.library.rows).toHaveLength(1);
    expect(fakeDb.library.rows[0].available).toBe(true);
  });

  it.each(["bookName", "authorName", "language", "genre", "donatedBy"])("rejects a missing %s", async (field) => {
    const input: any = bookInput();
    delete input[field];
    const res = await post(input);
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: `Invalid Input : Provide Required input for ${field}` });
    expect(fakeDb.library.rows).toHaveLength(0);
  });

  it("rejects whitespace-only fields", async () => {
    const res = await post(bookInput({ genre: "   " }));
    expect(res.json().message).toBe("Invalid Input : Provide Required input for genre");
  });

  it("rejects a duplicate title case-insensitively", async () => {
    seedBook();
    const res = await post(bookInput({ bookName: "dUNE" }));
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "Invalid Input : dUNE Is Already In The Library" });
    expect(fakeDb.library.rows).toHaveLength(1);
  });

  it("non-string fields produce a raw TypeError message (no type validation)", async () => {
    const res = await post(bookInput({ authorName: 42 }));
    expect(res.json().status).toBe("ERROR");
    expect(res.json().message).toMatch(/trim is not a function/);
  });

  it("BUG: LIKE wildcards in bookName are not escaped — '%' is reported as a duplicate of any book", async () => {
    // library-routes.ts:31 uses ILike(userInput) for an equality check.
    seedBook({ bookName: "Some Other Title" });
    const res = await post(bookInput({ bookName: "%" }));
    expect(res.json().status).toBe("ERROR");
    expect(res.json().message).toBe("Invalid Input : % Is Already In The Library");
  });
});

describe("GET /getallbooks (public)", () => {
  it("returns ERROR envelope when the library is empty", async () => {
    const res = await app.inject({ method: "GET", url: "/getallbooks" });
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "No Books are there In The library" });
  });

  it("returns every book", async () => {
    seedBook();
    seedBook({ bookName: "Emma", available: false });
    const res = await app.inject({ method: "GET", url: "/getallbooks" });
    const body = res.json();
    expect(body.status).toBe("SUCCESS");
    expect(body.data.map((b: any) => b.bookName)).toEqual(["Dune", "Emma"]);
  });
});

describe("PUT /updatebook (admin)", () => {
  it("requires a bookName", async () => {
    const res = await put({ authorName: "X" });
    expect(res.json().message).toBe("Invalid Input : Provide The Required Input For BookName");
  });

  it("rejects a non-string bookName", async () => {
    const res = await put({ bookName: 7 });
    expect(res.json().message).toBe("Invalid Input : Provide The Required Input For BookName");
  });

  it("returns ERROR for an unknown book", async () => {
    const res = await put({ bookName: "Ghost", authorName: "X" });
    expect(res.json().message).toBe("The Book Ghost Is Not Found In The Library");
  });

  it("updates the supplied fields, keeps the rest, and stamps updatedAt", async () => {
    const row = seedBook();
    const res = await put({ bookName: "Dune", authorName: "F. Herbert", genre: "Classic" });
    expect(res.json()).toEqual({ status: "SUCCESS", message: "The Book Dune Updated successfully" });
    expect(row).toMatchObject({ authorName: "F. Herbert", genre: "Classic", language: "English", donatedBy: "Alice" });
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("matches the book name case-insensitively", async () => {
    const row = seedBook();
    await put({ bookName: "dune", language: "French" });
    expect(row.language).toBe("French");
  });

  it("rejects an empty-string field", async () => {
    const row = seedBook();
    const res = await put({ bookName: "Dune", authorName: "  " });
    expect(res.json().message).toBe("Invalid Input: Provide Required Input for authorName");
    expect(row.authorName).toBe("Frank Herbert");
  });

  it("rejects a non-string field", async () => {
    seedBook();
    const res = await put({ bookName: "Dune", genre: 5 });
    expect(res.json().message).toBe("Invalid Input: Provide Required Input for genre");
  });

  it("rejects an update that supplies no fields besides bookName", async () => {
    const row = seedBook();
    const res = await put({ bookName: "Dune" });
    expect(res.json().message).toBe("Invalid Input : Provide the Required Inputs For Book Updation");
    expect(row.updatedAt).toBeNull();
  });

  it("BUG: LIKE wildcards are not escaped — bookName '%' updates an arbitrary (first) book", async () => {
    // library-routes.ts:99 uses ILike(bookName) to locate the book to update.
    const row = seedBook({ bookName: "Real Title" });
    const res = await put({ bookName: "%", authorName: "Hijacked" });
    expect(res.json().status).toBe("SUCCESS");
    expect(row.authorName).toBe("Hijacked");
  });
});

describe("DELETE /deletebook (admin)", () => {
  it("requires the bookName query param", async () => {
    const res = await del("");
    expect(res.json().message).toBe("Invalid Input : Provide Required Input");
  });

  it("returns ERROR when the book does not exist", async () => {
    const res = await del("?bookName=Ghost");
    expect(res.json().message).toBe("Invalid Input : Book Unavailable");
  });

  it("deletes an existing book", async () => {
    seedBook();
    seedBook({ bookName: "Emma" });
    const res = await del("?bookName=Dune");
    expect(res.json()).toEqual({ status: "SUCCESS", message: "The Book Dune Deleted successfully" });
    expect(fakeDb.library.rows.map((b) => b.bookName)).toEqual(["Emma"]);
  });

  it("uses an exact (case-sensitive) match, unlike post/update", async () => {
    seedBook();
    const res = await del("?bookName=dune");
    expect(res.json().status).toBe("ERROR");
    expect(fakeDb.library.rows).toHaveLength(1);
  });

  it("handles URL-encoded names", async () => {
    seedBook({ bookName: "War and Peace" });
    const res = await del("?bookName=War%20and%20Peace");
    expect(res.json().status).toBe("SUCCESS");
  });

  it("allows deleting a book that is currently on loan (no referential check)", async () => {
    seedBook({ available: false });
    fakeDb.lendrecords.seed({ userId: "u", bookName: "Dune", mailId: "m", lendDate: new Date() });
    const res = await del("?bookName=Dune");
    expect(res.json().status).toBe("SUCCESS");
  });
});

describe("GET /getbookbyquery (user)", () => {
  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/getbookbyquery?genre=Sci-Fi" });
    expect(res.statusCode).toBe(401);
  });

  it("returns ERROR when no query params are supplied", async () => {
    const res = await query("");
    expect(res.json().message).toBe("Invalid Input : Provide the Required Inputs");
  });

  it("filters by a single field", async () => {
    seedBook();
    seedBook({ bookName: "Emma", genre: "Romance" });
    const res = await query("?genre=Romance");
    expect(res.json().status).toBe("SUCCESS");
    expect(res.json().data.map((b: any) => b.bookName)).toEqual(["Emma"]);
  });

  it("ANDs multiple fields", async () => {
    seedBook();
    seedBook({ bookName: "Dune Messiah", language: "French" });
    const res = await query("?authorName=Frank%20Herbert&language=French");
    expect(res.json().data.map((b: any) => b.bookName)).toEqual(["Dune Messiah"]);
  });

  it("is exact-match / case-sensitive", async () => {
    seedBook();
    const res = await query("?bookName=dune");
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "The Request Is Not Available" });
  });

  it("ignores unknown query params; only unknown params counts as no input", async () => {
    seedBook();
    const res = await query("?foo=bar");
    expect(res.json().message).toBe("Invalid Input : Provide the Required Inputs");
  });
});
