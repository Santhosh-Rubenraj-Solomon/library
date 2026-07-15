import { getRepository } from "typeorm";
import { Users } from "../entity/users";
import { RequestGenericInterface } from "fastify";
import * as dotenv from 'dotenv';
import db from "../db";
import * as jwt from "jsonwebtoken";

export default function userRoutes(fastify, options, done) {
	const userRepo = fastify.db.userrecords;

	fastify.post("/usersignin", async (req, res) => {

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
               

        });
   
	done();
}
