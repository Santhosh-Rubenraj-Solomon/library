import { getRepository, In } from "typeorm";
import { Library } from "../entity/books";
import { Lend } from "../entity/lends";
import { Users } from "../entity/users";
import { RequestGenericInterface } from "fastify";
import db from "../db";

export default function lendRoutes(fastify, options, done) {
	const libRepo = fastify.db.library;
	const userRepo = fastify.db.userrecords;
	const lendRepo = fastify.db.lendrecords;
	const resRepo = fastify.db.reservationrecords;


	fastify.post("/lendbook", async (req, res) => {
		try {

			const book = {
				userId: req.body.user.userId,
				bookName: req.body.data.bookName,
				mailId: req.body.user.mailId,
				lendDate: req.body.data.lendDate
			};
			console.log("Input To lend a book ->", book);
                        console.log("DATE: ",new Date()); 

			Object.entries(book).forEach((entry) => {
				const [bookKey, bookValue] = entry;

				if (typeof entry[1] !== "string" || entry[1] == undefined || entry[1].trim().length == 0) {
					throw new Error("Invalid Input : Provide Required Input");
				}
			});

			const findBook = await libRepo.findOne({where: { bookName: book.bookName },});
			console.log("To Find The Book Is In The Library --->",findBook);

			if (findBook == null) {
				throw new Error(`The Requested Book ${book.bookName} Is Not Available In The Library`);
			}

			if (findBook != null && findBook.available === true) {

					// Queue gate: if someone is next in line ("ready"), only they may take it.
					const ready = await resRepo.findOne({ where: { bookName: book.bookName, status: "ready" } });
					if (ready && ready.userId !== req.body.user.userId) {
						throw new Error(`${book.bookName} is reserved for the next person in the queue.`);
					}

					// 14-day loan period.
					const due = new Date(book.lendDate);
					due.setDate(due.getDate() + 14);

					const lendBook = await lendRepo.save({ ...book, dueDate: due });
					await libRepo.update(findBook.bookId, { available: false });

					// Clear the borrower's own reservation for this book, if any.
					const mine = await resRepo.findOne({
						where: { bookName: book.bookName, userId: req.body.user.userId, status: In(["waiting", "ready"]) },
					});
					if (mine) await resRepo.update(mine.reservationId, { status: "fulfilled" });

					return {
						status: "SUCCESS",
						data: lendBook,
						message: "The Book Lent successfully",
					};
				} else {
					throw new Error(`${book.bookName} Is Not Available`);
				}
		} catch (e) {
			return {
				status: "ERROR",
				data: null,
				message: e.message,
			};
		}
	});

	fastify.get("/getlendedbooks", async (req, res) => {
                
                console.log('Incoming Request object: ',req); 

		const getLendedBooks = await lendRepo.find({where: { returned: false }});
		console.log("Check the Lent books ->", getLendedBooks);

		if (getLendedBooks.length != 0) {
			return {
				status: "SUCCESS",
				data: getLendedBooks,
				message: "The Lent Books Fetched successfully",
			};
		} else {
			return {
				status: "ERROR",
				data: null,
				message: "There Are No Lent Books In The library",
			};
		}
	});

	fastify.get("/lendedbooksbyuser", async (req, res) => {
		try {

                        console.log('Incoming Request object: ',req);

			// FIX (Task 0): browsers can't send a GET body, so read the
			// user from the verified JWT (req.body.user) like
			// /getbooksreturnedbyuser does, instead of req.body.data.userId.
			const userId = req.body.user.userId;
			console.log("UserId from token ->",userId);

			const booksLentByUser = await lendRepo.findOne({where: { userId, returned: false }});
			console.log("Total Books lend by particular user ->",booksLentByUser);

			if (booksLentByUser != null) {
					return {
						status: "SUCCESS",
						data: booksLentByUser,
						message: "The Total Lent Books By user Found successfully",
					};
			} else {
				throw new Error("The User Does Not Lend Any Books / returned every lended books");
			}
		} catch (e) {
			return {
				status: "ERROR",
				data: null,
				message: e.message,
			};
		}
	});

	done();
}
