import "reflect-metadata";
import { DataSource } from "typeorm";
import { Library } from "./entity/books";
import { Lend } from "./entity/lends";
import { Users } from "./entity/users";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.HOST || "localhost",
  port: Number(process.env.DBPORT) || 5432,
  username: process.env.DBUSERNAME || "postgres",
  password: process.env.DBPASS || "postgres",
  database: process.env.DBNAME || "library",
  synchronize: true, // demo only — replace with migrations for production
  logging: false,
  entities: [Library, Lend, Users],
});
