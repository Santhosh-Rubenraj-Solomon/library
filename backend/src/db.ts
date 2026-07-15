import fp from "fastify-plugin";
import { AppDataSource } from "./data-source";
import { Library } from "./entity/books";
import { Lend } from "./entity/lends";
import { Users } from "./entity/users";

export default fp(async (server) => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    server.log.info("connected to db");
  }
  server.decorate("db", {
    library: AppDataSource.getRepository(Library),
    lendrecords: AppDataSource.getRepository(Lend),
    userrecords: AppDataSource.getRepository(Users),
  });
});
