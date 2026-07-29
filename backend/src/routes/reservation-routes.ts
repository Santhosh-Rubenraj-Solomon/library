import { In } from "typeorm";
import db from "../db";

/**
 * Waitlist for on-loan books. Bodies arrive wrapped as { data, user } by the
 * auth gate, so we read the book name from req.body.data and the caller from
 * req.body.user (the verified JWT).
 */
export default function reservationRoutes(fastify, options, done) {
  const resRepo = fastify.db.reservationrecords;
  const libRepo = fastify.db.library;
  const lendRepo = fastify.db.lendrecords;

  const activeQueue = (bookName: string) =>
    resRepo.find({
      where: { bookName, status: In(["waiting", "ready"]) },
      order: { createdAt: "ASC" },
    });

  const currentDue = async (bookName: string) => {
    const lend = await lendRepo.findOne({ where: { bookName, returned: false } });
    return lend?.dueDate ?? null;
  };

  // Join the queue for a book that's on loan.
  fastify.post("/reservebook", async (req, res) => {
    try {
      const bookName: string = req.body?.data?.bookName;
      const user = req.body.user;
      if (!bookName || !bookName.trim()) throw new Error("Provide a book to reserve.");

      const book = await libRepo.findOne({ where: { bookName } });
      if (!book) throw new Error(`The book ${bookName} is not in the library.`);
      if (book.available) throw new Error(`${bookName} is available now — borrow it directly.`);

      const holding = await lendRepo.findOne({
        where: { bookName, userId: user.userId, returned: false },
      });
      if (holding) throw new Error(`You already have ${bookName} on loan.`);

      let queue = await activeQueue(bookName);
      let mine = queue.find((r: any) => r.userId === user.userId);
      if (!mine) {
        mine = await resRepo.save({ bookName, userId: user.userId, mailId: user.mailId, status: "waiting" });
        queue = await activeQueue(bookName);
      }
      const position = queue.findIndex((r: any) => r.reservationId === mine.reservationId) + 1;

      return {
        status: "SUCCESS",
        data: { bookName, position, status: mine.status, dueDate: await currentDue(bookName) },
        message: `Reserved — you're #${position} in the queue for ${bookName}.`,
      };
    } catch (e) {
      return { status: "ERROR", data: null, message: e.message };
    }
  });

  // The caller's active reservations, each with live queue position + due date.
  fastify.get("/myreservations", async (req, res) => {
    const user = req.body.user;
    const mine = await resRepo.find({
      where: { userId: user.userId, status: In(["waiting", "ready"]) },
      order: { createdAt: "ASC" },
    });
    const data: any[] = [];
    for (const r of mine) {
      const queue = await activeQueue(r.bookName);
      const position = queue.findIndex((q: any) => q.reservationId === r.reservationId) + 1;
      data.push({
        reservationId: r.reservationId,
        bookName: r.bookName,
        status: r.status,
        position,
        createdAt: r.createdAt,
        dueDate: await currentDue(r.bookName),
      });
    }
    return { status: "SUCCESS", data, message: "Your reservations." };
  });

  fastify.post("/cancelreservation", async (req, res) => {
    try {
      const bookName: string = req.body?.data?.bookName;
      const user = req.body.user;
      const mine = await resRepo.findOne({
        where: { bookName, userId: user.userId, status: In(["waiting", "ready"]) },
      });
      if (!mine) throw new Error("You don't have an active reservation for this book.");
      await resRepo.update(mine.reservationId, { status: "cancelled" });
      // If they were at the front, promote the next person.
      if (mine.status === "ready") {
        const next = await resRepo.findOne({
          where: { bookName, status: "waiting" },
          order: { createdAt: "ASC" },
        });
        if (next) await resRepo.update(next.reservationId, { status: "ready" });
      }
      return { status: "SUCCESS", data: null, message: "Reservation cancelled." };
    } catch (e) {
      return { status: "ERROR", data: null, message: e.message };
    }
  });

  // Admin: the whole active waitlist.
  fastify.get("/getreservations", async (req, res) => {
    const all = await resRepo.find({
      where: { status: In(["waiting", "ready"]) },
      order: { createdAt: "ASC" },
    });
    return { status: "SUCCESS", data: all, message: "Active reservations." };
  });

  done();
}
