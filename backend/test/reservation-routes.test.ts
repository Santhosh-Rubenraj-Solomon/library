import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { getApp, auth, admin, alice, bob, carol } from "./helpers/app";
import { fakeDb } from "./helpers/fake-db";
import { seedBook } from "./helpers/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await getApp();
});

type U = typeof alice;
const reserve = (bookName: any, user: U = alice) =>
  app.inject({ method: "POST", url: "/reservebook", headers: auth(user), payload: bookName === undefined ? {} : { bookName } });
const cancel = (payload: any, user: U = alice) =>
  app.inject({ method: "POST", url: "/cancelreservation", headers: auth(user), payload });
const mine = (user: U = alice) => app.inject({ method: "GET", url: "/myreservations", headers: auth(user) });
const lend = (bookName: string, user: U) =>
  app.inject({ method: "POST", url: "/lendbook", headers: auth(user), payload: { bookName, lendDate: "2025-03-01" } });
const ret = (bookName: string, user: U) =>
  app.inject({ method: "POST", url: "/returnbook", headers: auth(user), payload: { bookName } });

/** Dune exists and is on loan to `holder`. */
function onLoan(holder: U = carol, bookName = "Dune") {
  seedBook({ bookName, available: false });
  return fakeDb.lendrecords.seed({
    userId: holder.userId,
    mailId: holder.mailId,
    bookName,
    lendDate: new Date("2025-03-01"),
    dueDate: new Date("2025-03-15"),
  });
}

describe("POST /reservebook", () => {
  it("requires authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/reservebook", payload: { bookName: "Dune" } });
    expect(res.statusCode).toBe(401);
  });

  it.each([undefined, "", "   "])("rejects a missing/blank book name (%j)", async (name) => {
    const res = await reserve(name);
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "Provide a book to reserve." });
  });

  it("rejects a book that is not in the library", async () => {
    const res = await reserve("Ghost");
    expect(res.json().message).toBe("The book Ghost is not in the library.");
  });

  it("rejects reserving a book that is available now", async () => {
    seedBook();
    const res = await reserve("Dune");
    expect(res.json().message).toBe("Dune is available now — borrow it directly.");
    expect(fakeDb.reservationrecords.rows).toHaveLength(0);
  });

  it("rejects the current borrower reserving their own loan", async () => {
    onLoan(alice);
    const res = await reserve("Dune", alice);
    expect(res.json().message).toBe("You already have Dune on loan.");
  });

  it("joins the queue at position 1 with the current due date", async () => {
    onLoan();
    const res = await reserve("Dune");
    expect(res.json()).toEqual({
      status: "SUCCESS",
      data: { bookName: "Dune", position: 1, status: "waiting", dueDate: "2025-03-15T00:00:00.000Z" },
      message: "Reserved — you're #1 in the queue for Dune.",
    });
    expect(fakeDb.reservationrecords.rows[0]).toMatchObject({ bookName: "Dune", userId: alice.userId, mailId: alice.mailId, status: "waiting" });
  });

  it("assigns increasing positions in FIFO order", async () => {
    onLoan();
    expect((await reserve("Dune", alice)).json().data.position).toBe(1);
    expect((await reserve("Dune", bob)).json().data.position).toBe(2);
  });

  it("is idempotent: reserving again returns the existing spot without a duplicate", async () => {
    onLoan();
    await reserve("Dune", alice);
    await reserve("Dune", bob);
    const again = await reserve("Dune", alice);
    expect(again.json().data.position).toBe(1);
    expect(fakeDb.reservationrecords.rows).toHaveLength(2);
  });

  it("a cancelled reservation does not count; re-reserving goes to the back", async () => {
    onLoan();
    await reserve("Dune", alice);
    await reserve("Dune", bob);
    await cancel({ bookName: "Dune" }, alice);
    const res = await reserve("Dune", alice);
    expect(res.json().data.position).toBe(2);
  });
});

describe("GET /myreservations", () => {
  it("returns an empty list when the user has none", async () => {
    const res = await mine();
    expect(res.json()).toEqual({ status: "SUCCESS", data: [], message: "Your reservations." });
  });

  it("lists only active reservations with live position and due date", async () => {
    onLoan(carol, "Dune");
    onLoan(carol, "Emma");
    await reserve("Dune", bob);
    await reserve("Dune", alice);
    await reserve("Emma", alice);
    fakeDb.reservationrecords.seed({ bookName: "Old", userId: alice.userId, mailId: alice.mailId, status: "cancelled" });

    const data = (await mine(alice)).json().data;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ bookName: "Dune", position: 2, status: "waiting", dueDate: "2025-03-15T00:00:00.000Z" });
    expect(data[0].reservationId).toEqual(expect.any(String));
    expect(data[1]).toMatchObject({ bookName: "Emma", position: 1 });
  });

  it("reports dueDate null when the book is no longer on loan", async () => {
    seedBook();
    fakeDb.reservationrecords.seed({ bookName: "Dune", userId: alice.userId, mailId: alice.mailId, status: "ready" });
    const data = (await mine()).json().data;
    expect(data[0]).toMatchObject({ status: "ready", position: 1, dueDate: null });
  });
});

describe("POST /cancelreservation", () => {
  it("returns ERROR when the user has no active reservation for the book", async () => {
    const res = await cancel({ bookName: "Dune" });
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "You don't have an active reservation for this book." });
  });

  it("cancels a waiting reservation without promoting anyone", async () => {
    onLoan();
    await reserve("Dune", alice);
    await reserve("Dune", bob);
    const res = await cancel({ bookName: "Dune" }, alice);
    expect(res.json()).toEqual({ status: "SUCCESS", data: null, message: "Reservation cancelled." });
    const [a, b] = fakeDb.reservationrecords.rows;
    expect(a.status).toBe("cancelled");
    expect(b.status).toBe("waiting");
  });

  it("cancelling a 'ready' reservation promotes the next waiting user", async () => {
    seedBook();
    const ready = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: alice.userId, mailId: alice.mailId, status: "ready" });
    const next = fakeDb.reservationrecords.seed({ bookName: "Dune", userId: bob.userId, mailId: bob.mailId, status: "waiting" });
    await cancel({ bookName: "Dune" }, alice);
    expect(ready.status).toBe("cancelled");
    expect(next.status).toBe("ready");
  });

  it("cannot cancel someone else's reservation", async () => {
    onLoan();
    await reserve("Dune", bob);
    const res = await cancel({ bookName: "Dune" }, alice);
    expect(res.json().status).toBe("ERROR");
    expect(fakeDb.reservationrecords.rows[0].status).toBe("waiting");
  });

  it("BUG: with no bookName it cancels an arbitrary active reservation of the caller", async () => {
    // reservation-routes.ts:86 — where: { bookName: undefined, ... } drops the
    // bookName condition in TypeORM 0.3, so the first active reservation is cancelled.
    onLoan();
    await reserve("Dune", alice);
    const res = await cancel({}, alice);
    expect(res.json().status).toBe("SUCCESS");
    expect(fakeDb.reservationrecords.rows[0].status).toBe("cancelled");
  });
});

describe("GET /getreservations (admin)", () => {
  it("is admin-only", async () => {
    const res = await app.inject({ method: "GET", url: "/getreservations", headers: auth(alice) });
    expect(res.statusCode).toBe(403);
  });

  it("lists all active reservations oldest first", async () => {
    fakeDb.reservationrecords.seed({ bookName: "A", userId: "1", mailId: "1", status: "waiting" });
    fakeDb.reservationrecords.seed({ bookName: "B", userId: "2", mailId: "2", status: "fulfilled" });
    fakeDb.reservationrecords.seed({ bookName: "C", userId: "3", mailId: "3", status: "ready" });
    const res = await app.inject({ method: "GET", url: "/getreservations", headers: auth(admin) });
    expect(res.json().status).toBe("SUCCESS");
    expect(res.json().data.map((r: any) => r.bookName)).toEqual(["A", "C"]);
  });
});

describe("end-to-end waitlist flow", () => {
  it("borrow → reserve → return → ready user borrows → queue advances", async () => {
    seedBook();
    expect((await lend("Dune", carol)).json().status).toBe("SUCCESS");
    expect((await reserve("Dune", alice)).json().data.position).toBe(1);
    expect((await reserve("Dune", bob)).json().data.position).toBe(2);

    expect((await ret("Dune", carol)).json().status).toBe("SUCCESS");
    expect((await mine(alice)).json().data[0]).toMatchObject({ status: "ready", position: 1 });

    // Bob is not first → blocked by the queue gate.
    expect((await lend("Dune", bob)).json().message).toBe("Dune is reserved for the next person in the queue.");

    // Alice borrows; her reservation is fulfilled and Bob moves up.
    expect((await lend("Dune", alice)).json().status).toBe("SUCCESS");
    expect((await mine(alice)).json().data).toEqual([]);
    expect((await mine(bob)).json().data[0]).toMatchObject({ position: 1, status: "waiting" });

    // When Alice returns it, Bob is promoted.
    await ret("Dune", alice);
    expect((await mine(bob)).json().data[0].status).toBe("ready");
  });

  it("BUG: while a book is held 'ready' for someone, other users can neither borrow nor join the queue", async () => {
    // After a return the book is available=true but reserved for the 'ready' user.
    // /lendbook rejects others (queue gate) and /reservebook rejects because
    // `book.available` is true (reservation-routes.ts:34), so a third user is stuck.
    seedBook();
    await lend("Dune", carol);
    await reserve("Dune", alice);
    await ret("Dune", carol);

    expect((await lend("Dune", bob)).json().message).toBe("Dune is reserved for the next person in the queue.");
    expect((await reserve("Dune", bob)).json().message).toBe("Dune is available now — borrow it directly.");
  });
});
