import { getRepository } from "typeorm";
import {ILike} from "typeorm";
import { Library } from "../entity/books";
import db from "../db";

export default function libraryRoutes(fastify, options, done) {
	const libRepo = fastify.db.library;

	fastify.post("/postnewbook", async (req, res) => {
                
                console.log('Incoming Request object: ',req);
		try {
			const newBook = {
				bookName: req.body.data.bookName,
				authorName: req.body.data.authorName,
				language: req.body.data.language,
				genre: req.body.data.genre,
				donatedBy: req.body.data.donatedBy,
			};
			console.log("Input Data To Post A Book: ", newBook);

                        Object.entries(newBook).forEach((book) => {
                                const [bookKey,bookValue] = book;
                               
                                if (book[1] == undefined || book[1] == null || book[1].trim().length  == 0) {
                                        throw new Error(`Invalid Input : Provide Required input for ${bookKey}`); 
                                } 
  
                        });

			const getBook = await libRepo.findOne({where: { bookName: ILike(newBook.bookName)}});
			console.log("To Check Whether The Book Is Already In The library: ",getBook);

			if (getBook == null) {

				const postBook = await libRepo.save(newBook);
				console.log("New Book posted in the library: ",postBook);

				return {
					status: "SUCCESS",
					data: postBook,
					message: `${newBook.bookName} book added successfully`,
				};
			} else {
				throw new Error(`Invalid Input : ${newBook.bookName.trim()} Is Already In The Library`);
			}
		} catch (e) {
			return {
				status: "ERROR",
				data: null,
				message: e.message,
			};
		}
	});


	fastify.get("/getallbooks", async (req, res) => {

                console.log('Incoming Request object: ',req);

		const getBooks = await libRepo.find();
		console.log("Getting Available books from the Library: ",getBooks);

		if (getBooks.length != 0) {
			return {
				status: "SUCCESS",
				data: getBooks,
				message: "The Books Fetched successfully",
			};
		} else {
			return {
				status: "ERROR",
				data: null,
				message: "No Books are there In The library",
			};
		}
	});

	fastify.put("/updatebook", async (req, res) => {

                    console.log('Incoming Request object: ',req);

		try {
			const bookName = req.body.data.bookName;
			console.log("bookName for the book updation: ", bookName);

			if (typeof bookName !== "string" || !bookName) {
				throw new Error("Invalid Input : Provide The Required Input For BookName");
			}
                        
			const newBook = {
				authorName: req.body.data.authorName,
				language: req.body.data.language,
				genre: req.body.data.genre,
				donatedBy: req.body.data.donatedBy,
			};
                        console.log(`Input's For Updation : `, newBook);

			const findBook = await libRepo.findOne({where: { bookName: ILike( bookName) },});
			console.log("To find the book For Updation is in the library ->",findBook);

			if (findBook == null) {
				throw new Error(`The Book ${bookName} Is Not Found In The Library`);
			}

			if (JSON.stringify(newBook) === "{}") {
				throw new Error("Invalid Input : Provide the Required Inputs For Book Updation");
			}

			
                        Object.entries(newBook).forEach((book) => {
                                        const [bookKey, bookValue] = book;

                                        if (book[1] != undefined && book[1] != null) {

                                                if (typeof book[1] != "string" || book[1].trim().length == 0) {

                                                        throw new Error(`Invalid Input: Provide Required Input for ${bookKey}`);
                                                }
                                        }
                        });
                      

			const updateBook = await libRepo.update(findBook.bookId,{ ...newBook,updatedAt:new Date() });

			return {
				status: "SUCCESS",
				message: `The Book ${bookName} Updated successfully`,
			};
                        
                        
		} catch (e) {
			return {
				status: "ERROR",
				data: null,
				message: e.message,
			};
		}
	});

	fastify.delete("/deletebook", async (req, res) => {
		
		console.log('Incoming Request object: ',req);

		try {
			const bookName  = req.query.bookName;
			console.log("Input Query For Book Deletion: ", bookName);

			if (typeof bookName != "string") {
				throw new Error("Invalid Input : Provide Required Input");
			} else {
				const getBook = await libRepo.findOne({where: { bookName :(bookName)},});

				if (getBook != null) {
					const deleteBook = await libRepo.delete({ bookName });

					return {
						status: "SUCCESS",
						message: `The Book ${ bookName } Deleted successfully`,
					};
				} else {
					throw new Error(`Invalid Input : Book Unavailable`);
				}
			}
		} catch (e) {
			return {
				status: "ERROR",
				data: null,
				message: e.message,
			};
		}
	});

	fastify.get("/getbookbyquery", async (req, res) => {
		
		console.log('Incoming Request object: ',req);

		try {
			const queryParams = {
				bookName: req.query.bookName,
				authorName: req.query.authorName,
				language: req.query.language,
				genre: req.query.genre,
				donatedBy: req.query.donatedBy,
			};
                        console.log("queryParams to get book from library: ",queryParams);

			if (JSON.stringify(queryParams) === "{}") {
				throw new Error("Invalid Input : Provide the Required Inputs");
			}


			const book = await libRepo.find({where: {...queryParams}});
			console.log("Requested Book: ", book);

			if (book.length == 0) {
				throw new Error(`The Request Is Not Available`);
			} else {
				return {
					status: "SUCCESS",
					data: book,
					message: "The Requested Book fetched successfully",
				};
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
