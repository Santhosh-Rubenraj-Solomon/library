import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { getApp, auth, admin, alice, bob, carol } from "./helpers/app";
import { fakeDb } from "./helpers/fake-db";
import { seedBook } from "./helpers/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await getApp();
});

const ret = (payload: any, user = alice) => app.inject({ method: "POST", url: "/returnbook", headers: auth(user), payload });
const seedLoan = (user: { userId: string; mailId: string }, bookName = "Dune", extra: any = {}) =>
  fakeDb.lendrecords.seed({ userId: user.userId, mailId: user.mailId, bookName, lendDate: new Date("2025-01-01"), ...extra });

describe("POST /returnbook", () => {
  it("requires authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/returnbook", payload: { bookName: "Dune" } });
    expect(res.statusCode).toBe(401);
  });

  it("marks the loan returned with a real Date and makes the book available again", async () => {
    const book = seedBook({ available: false });
    const loan = seedLoan(alice);
    const res = await ret({ bookName: "Dune" });
    expect(res.json()).toMatchObject({ status: "SUCCESS", message: "The Book Dune returned successfully" });
    expect(loan.returned).toBe(true);
    expect(loan.returnDate).toBeInstanceOf(Date); // regression for the old `Date()` string bug
    expect(book.available).toBe(true);
  });

  it("promotes the oldest 'waiting' reservation to 'ready'", async () => {
    seedBook({ available: false });
    seedLoan(alice);
    const first = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: bob.userId, mailId: bob.mailId, status: "waiting" });
    const second = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: carol.userId, mailId: carol.mailId, status: "waiting" });
    await ret({ bookName: "Dune" });
    expect(first.status).toBe("ready");
    expect(second.status).toBe("waiting");
  });

  it("ignores cancelled reservations and those for other books when promoting", async () => {
    seedBook({ available: false });
    seedLoan(alice);
    const cancelled = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: bob.userId, mailId: bob.mailId, status: "cancelled" });
    const other = fakeDb.reservationrecords.seed({ bookName: "Emma", userId: bob.userId, mailId: bob.mailId, status: "waiting" });
    const next = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: carol.userId, mailId: carol.mailId, status: "waiting" });
    await ret({ bookName: "Dune" });
    expect(cancelled.status).toBe("cancelled");
    expect(other.status).toBe("waiting");
    expect(next.status).toBe("ready");
  });

  it.each([
    ["missing", {}],
    ["blank", { bookName: "   " }],
  ])("rejects a %s bookName", async (_l, payload) => {
    const res = await ret(payload);
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "Invalid Input : Provide Required Input" });
  });

  it("non-string bookName yields a raw TypeError message", async () => {
    const res = await ret({ bookName: 123 });
    expect(res.json().status).toBe("ERROR");
    expect(res.json().message).toMatch(/trim is not a function/);
  });

  it("returns ERROR for an unknown book", async () => {
    const res = await ret({ bookName: "Ghost" });
    expect(res.json().message).toBe("The book Ghost is not found");
  });

  it("returns ERROR when the user never borrowed anything", async () => {
    seedBook();
    const res = await ret({ bookName: "Dune" });
    expect(res.json().message).toBe(`${alice.mailId} Does Not Lend Any Books`);
  });

  it("cannot return a book someone else borrowed", async () => {
    const book = seedBook({ available: false });
    const loan = seedLoan(bob);
    const res = await ret({ bookName: "Dune" }, alice);
    expect(res.json().status).toBe("ERROR");
    expect(loan.returned).toBe(false);
    expect(book.available).toBe(false);
  });

  it("returning twice fails the second time", async () => {
    seedBook({ available: false });
    seedLoan(alice);
    expect((await ret({ bookName: "Dune" })).json().status).toBe("SUCCESS");
    const second = await ret({ bookName: "Dune" });
    expect(second.json()).toEqual({ status: "ERROR", data: null, message: `${alice.mailId} Returned The Book Dune` });
  });

  it("misleading message: a user who borrowed OTHER books is told they 'Returned' a book they never had", async () => {
    // return-routes.ts:66 — any lendInfo==null case with prior loans reports "Returned The Book".
    seedBook();
    seedBook({ bookName: "Emma" });
    seedLoan(alice, "Emma");
    const res = await ret({ bookName: "Dune" });
    expect(res.json().message).toBe(`${alice.mailId} Returned The Book Dune`);
  });
});

describe("GET /getreturnedbooks (admin)", () => {
  it("returns ERROR when nothing has been returned", async () => {
    seedLoan(alice);
    const res = await app.inject({ method: "GET", url: "/getreturnedbooks", headers: auth(admin) });
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "No Books Returned" });
  });

  it("returns returned loans only", async () => {
    seedLoan(alice, "A", { returned: true, returnDate: new Date() });
    seedLoan(bob, "B");
    const res = await app.inject({ method: "GET", url: "/getreturnedbooks", headers: auth(admin) });
    expect(res.json().status).toBe("SUCCESS");
    expect(res.json().data.map((l: any) => l.bookName)).toEqual(["A"]);
  });
});

describe("GET /getbooksreturnedbyuser", () => {
  const get = (user = alice) => app.inject({ method: "GET", url: "/getbooksreturnedbyuser", headers: auth(user) });

  it("returns ERROR when the user never borrowed", async () => {
    const res = await get();
    expect(res.json().message).toBe("User Does Not Lend Any Books");
  });

  it("returns ERROR when the user has loans but none returned", async () => {
    seedLoan(alice);
    const res = await get();
    expect(res.json().message).toBe("User Does Not Returned Any Book");
  });

  it("returns only the caller's returned loans", async () => {
    seedLoan(alice, "A", { returned: true });
    seedLoan(alice, "B");
    seedLoan(bob, "C", { returned: true });
    const res = await get();
    expect(res.json().status).toBe("SUCCESS");
    expect(res.json().data.map((l: any) => l.bookName)).toEqual(["A"]);
  });
});
