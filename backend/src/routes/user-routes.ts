import { getRepository } from "typeorm";
import { Users } from "../entity/users";
import { RequestGenericInterface } from "fastify";
import * as dotenv from 'dotenv';
import db from "../db";
import * as jwt from "jsonwebtoken";
import { nonBlankString, objectSchema } from "../validation";

export default function userRoutes(fastify, options, done) {
	const userRepo = fastify.db.userrecords;

	// mailId is required: an undefined where-condition is DROPPED by TypeORM 0.3,
	// so findOne({ where: { mailId: undefined } }) would return the first stored
	// user (possibly an admin) and mint a token for them.
	fastify.post("/usersignin", {
		schema: { body: objectSchema({ mailId: nonBlankString }, ["mailId"]) },
		config: { validationMessage: "Invalid Input : Provide a mailId" },
	}, async (req, res) => {

               console.log('Incoming Request object: ',req);

                /**const token = req.headers.authorization; 
  
 		const decodedToken = jwt.verify(token,secret_key);
 
                const user = {
                             mailId : decodedToken.email,
                             role :  'user',
                             createdAt : Date(),
                            
                };**/
 
                const user = {
                             mailId: req.body.mailId,
                             role: 'user',
                };
                console.log('USER', user)                    
                let token = {};
           
 
                const findUser = await userRepo.findOne({where: {mailId : user.mailId}})
                console.log('to find whether the user info is already in db: ',findUser);
                
                if (findUser == null) {

                const addUser = await userRepo.save(user);
                console.log('newly added user to db: ',addUser);

                token = jwt.sign({ user : addUser },(process.env.JWT as string),{ expiresIn: "86400s" });
                console.log('auth token: ',{ token });


                } else {

                       const updateVisit = await userRepo.update(findUser.userId,{visitCount : findUser.visitCount + 1})

                       token = jwt.sign({ user : findUser },(process.env.JWT as string),{ expiresIn: "86400s" });
                       console.log('auth token: ',{ token });
                 
                  }

                return {
                       status : 'SUCCESS',
                       data : token
                }
			
	});

        fastify.get("/getusers", async (req,res) => {
                      
		console.log('Incoming Request object: ',req)

                const findUsers = await userRepo.find();
                console.log('AVAILABLE USERS --->',findUsers);

                if (findUsers.length != 0){
                       return {
                              status: 'SUCCESS',
                              data: findUsers,
                              message: 'The Users fetched Successfully'
                       } 

                }

                return {
                       status: 'SUCCESS',
                       data: [],
                       message: 'No Users found'
                }


        });

        // Admin-only: promote/demote a member. The auth gate wraps the body into
        // { data, user }, so the payload arrives as req.body.data. The primary
        // admin (SUPER_ADMIN) can never be demoted, so access can't be locked out.
        const SUPER_ADMIN = "santhoshrubenc@gmail.com";
        fastify.post("/setrole", {
                schema: {
                        body: objectSchema({ mailId: nonBlankString, role: { type: "string", enum: ["admin", "user"] } }, ["mailId", "role"]),
                },
                config: { validationMessage: "mailId and role ('admin' | 'user') are required." },
        }, async (req, res) => {
                const mailId = req.body?.data?.mailId;
                const role = req.body?.data?.role;

                if (!mailId || (role !== "admin" && role !== "user")) {
                        return res.code(400).send({
                                status: "ERROR",
                                message: "mailId and role ('admin' | 'user') are required.",
                        });
                }
                if (mailId === SUPER_ADMIN && role !== "admin") {
                        return res.code(403).send({
                                status: "ERROR",
                                message: "The primary admin cannot be demoted.",
                        });
                }

                const target = await userRepo.findOne({ where: { mailId } });
                if (target == null) {
                        return res.code(404).send({ status: "ERROR", message: "User not found." });
                }

                await userRepo.update(target.userId, { role });
                const updated = await userRepo.findOne({ where: { mailId } });

                return {
                        status: "SUCCESS",
                        data: updated,
                        message: `${mailId} is now ${role}.`,
                };
        });

	done();
}
