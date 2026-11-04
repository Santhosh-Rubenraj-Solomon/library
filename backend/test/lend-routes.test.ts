import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { getApp, auth, admin, alice, bob, tokenFor, seedAdmin } from "./helpers/app";
import { fakeDb } from "./helpers/fake-db";
import { seedBook } from "./helpers/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await getApp();
});
// Admin routes verify the caller's current role in the DB.
beforeEach(async () => {
  await seedAdmin();
});

const lend = (payload: any, user = alice) => app.inject({ method: "POST", url: "/lendbook", headers: auth(user), payload });

describe("POST /lendbook", () => {
  it("requires authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/lendbook", payload: { bookName: "Dune", lendDate: "2025-01-01" } });
    expect(res.statusCode).toBe(401);
  });

  it("lends an available book: records the loan with a 14-day due date and marks the book unavailable", async () => {
    const book = seedBook();
    const res = await lend({ bookName: "Dune", lendDate: "2025-01-01" });
    const body = res.json();
    expect(body.status).toBe("SUCCESS");
    expect(body.message).toBe("The Book Lent successfully");
    expect(body.data).toMatchObject({
      userId: alice.userId,
      mailId: alice.mailId,
      bookName: "Dune",
      lendDate: "2025-01-01",
      returned: false,
    });
    expect(new Date(body.data.dueDate).toISOString()).toBe("2025-01-15T00:00:00.000Z");
    expect(book.available).toBe(false);
    expect(fakeDb.lendrecords.rows).toHaveLength(1);
  });

  it("due date rolls over month boundaries", async () => {
    seedBook();
    const res = await lend({ bookName: "Dune", lendDate: "2025-01-25" });
    expect(new Date(res.json().data.dueDate).toISOString()).toBe("2025-02-08T00:00:00.000Z");
  });

  it.each([
    ["missing bookName", { lendDate: "2025-01-01" }],
    ["missing lendDate", { bookName: "Dune" }],
    ["blank bookName", { bookName: "  ", lendDate: "2025-01-01" }],
    ["non-string lendDate", { bookName: "Dune", lendDate: 20250101 }],
    ["non-string bookName", { bookName: ["Dune"], lendDate: "2025-01-01" }],
  ])("rejects %s", async (_label, payload) => {
    seedBook();
    const res = await lend(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "Invalid Input : Provide Required Input" });
    expect(fakeDb.lendrecords.rows).toHaveLength(0);
  });

  it("rejects with 401 when the token lacks userId (auth gate)", async () => {
    seedBook();
    const res = await app.inject({
      method: "POST",
      url: "/lendbook",
      headers: { authorization: `Bearer ${tokenFor({ role: "user" })}` },
      payload: { bookName: "Dune", lendDate: "2025-01-01" },
    });
    expect(res.statusCode).toBe(401);
    expect(fakeDb.lendrecords.rows).toHaveLength(0);
  });

  it("rejects when the token lacks mailId", async () => {
    seedBook();
    const res = await app.inject({
      method: "POST",
      url: "/lendbook",
      headers: { authorization: `Bearer ${tokenFor({ userId: "u-x", role: "user" })}` },
      payload: { bookName: "Dune", lendDate: "2025-01-01" },
    });
    expect(res.json().message).toBe("Invalid Input : Provide Required Input");
    expect(fakeDb.lendrecords.rows).toHaveLength(0);
  });

  it("returns ERROR for a book that is not in the library", async () => {
    const res = await lend({ bookName: "Ghost", lendDate: "2025-01-01" });
    expect(res.json().message).toBe("The Requested Book Ghost Is Not Available In The Library");
  });

  it("returns ERROR when the book is already on loan", async () => {
    seedBook();
    await lend({ bookName: "Dune", lendDate: "2025-01-01" }, alice);
    const res = await lend({ bookName: "Dune", lendDate: "2025-01-02" }, bob);
    expect(res.json().message).toBe("Dune Is Not Available");
    expect(fakeDb.lendrecords.rows).toHaveLength(1);
  });

  it("matches bookName exactly (case-sensitive)", async () => {
    seedBook();
    const res = await lend({ bookName: "dune", lendDate: "2025-01-01" });
    expect(res.json().message).toBe("The Requested Book dune Is Not Available In The Library");
  });

  it("queue gate: blocks everyone except the user whose reservation is 'ready'", async () => {
    seedBook();
    fakeDb.reservationrecords.seed({ bookName: "Dune", userId: bob.userId, mailId: bob.mailId, status: "ready" });
    const res = await lend({ bookName: "Dune", lendDate: "2025-01-01" }, alice);
    expect(res.json().message).toBe("Dune is reserved for the next person in the queue.");
    expect(fakeDb.lendrecords.rows).toHaveLength(0);
  });

  it("queue gate: the 'ready' user can borrow and their reservation becomes 'fulfilled'", async () => {
    const book = seedBook();
    const r = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: bob.userId, mailId: bob.mailId, status: "ready" });
    const res = await lend({ bookName: "Dune", lendDate: "2025-01-01" }, bob);
    expect(res.json().status).toBe("SUCCESS");
    expect(r.status).toBe("fulfilled");
    expect(book.available).toBe(false);
  });

  it("does not touch other users' reservations when lending", async () => {
    seedBook();
    const other = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: bob.userId, mailId: bob.mailId, status: "waiting" });
    const res = await lend({ bookName: "Dune", lendDate: "2025-01-01" }, alice);
    expect(res.json().status).toBe("SUCCESS");
    expect(other.status).toBe("waiting");
  });

  it("allows one user to hold several different books", async () => {
    seedBook();
    seedBook({ bookName: "Emma" });
    expect((await lend({ bookName: "Dune", lendDate: "2025-01-01" })).json().status).toBe("SUCCESS");
    expect((await lend({ bookName: "Emma", lendDate: "2025-01-01" })).json().status).toBe("SUCCESS");
  });

  it.each(["not-a-date", "2025-13-45"])("rejects an unparseable lendDate (%s) before hitting the database", async (lendDate) => {
    const book = seedBook();
    const res = await lend({ bookName: "Dune", lendDate });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "Invalid Input : lendDate must be a valid date" });
    expect(fakeDb.lendrecords.rows).toHaveLength(0);
    expect(book.available).toBe(true);
  });

  it("accepts a full ISO timestamp as lendDate", async () => {
    seedBook();
    const res = await lend({ bookName: "Dune", lendDate: "2025-01-01T10:00:00.000Z" });
    expect(res.json().status).toBe("SUCCESS");
  });
});

describe("GET /getlendedbooks (admin)", () => {
  it("returns ERROR when nothing is lent", async () => {
    const res = await app.inject({ method: "GET", url: "/getlendedbooks", headers: auth(admin) });
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "There Are No Lent Books In The library" });
  });

  it("returns only loans that are not returned", async () => {
    fakeDb.lendrecords.seed({ userId: "u1", bookName: "A", mailId: "m1", lendDate: new Date(), returned: false });
    fakeDb.lendrecords.seed({ userId: "u2", bookName: "B", mailId: "m2", lendDate: new Date(), returned: true });
    const res = await app.inject({ method: "GET", url: "/getlendedbooks", headers: auth(admin) });
    expect(res.json().status).toBe("SUCCESS");
    expect(res.json().data.map((l: any) => l.bookName)).toEqual(["A"]);
  });
});

describe("GET /lendedbooksbyuser", () => {
  const get = (user = alice) => app.inject({ method: "GET", url: "/lendedbooksbyuser", headers: auth(user) });

  it("reads the user from the token (no GET body needed) and returns their active loans", async () => {
    fakeDb.lendrecords.seed({ userId: alice.userId, bookName: "A", mailId: alice.mailId, lendDate: new Date() });
    fakeDb.lendrecords.seed({ userId: bob.userId, bookName: "B", mailId: bob.mailId, lendDate: new Date() });
    const res = await get();
    expect(res.json().status).toBe("SUCCESS");
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0]).toMatchObject({ bookName: "A", userId: alice.userId });
  });

  it("returns ERROR when the user has no active loans", async () => {
    fakeDb.lendrecords.seed({ userId: alice.userId, bookName: "A", mailId: alice.mailId, lendDate: new Date(), returned: true });
    const res = await get();
    expect(res.json()).toEqual({
      status: "ERROR",
      data: null,
      message: "The User Does Not Lend Any Books / returned every lended books",
    });
  });

  it("returns ALL active loans when the user holds several books (returned ones excluded)", async () => {
    fakeDb.lendrecords.seed({ userId: alice.userId, bookName: "A", mailId: alice.mailId, lendDate: new Date() });
    fakeDb.lendrecords.seed({ userId: alice.userId, bookName: "B", mailId: alice.mailId, lendDate: new Date() });
    fakeDb.lendrecords.seed({ userId: alice.userId, bookName: "C", mailId: alice.mailId, lendDate: new Date(), returned: true });
    const res = await get();
    expect(Array.isArray(res.json().data)).toBe(true);
    expect(res.json().data.map((l: any) => l.bookName)).toEqual(["A", "B"]);
  });
});
