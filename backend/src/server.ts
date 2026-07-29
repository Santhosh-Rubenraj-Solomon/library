import Fastify from "fastify";
import cors from "@fastify/cors";
import * as dotenv from "dotenv";
import * as jwt from "jsonwebtoken";

import db from "./db";
import libraryRoutes from "./routes/library-routes";
import lendRoutes from "./routes/lend-routes";
import userRoutes from "./routes/user-routes";
import returnRoutes from "./routes/return-routes";
import reservationRoutes from "./routes/reservation-routes";
import { routes, unauthorizedRoutes, adminRoutes } from "./rts";

dotenv.config();

const INSTANCE_ID = process.env.INSTANCE_ID || "backend";

const fastify = Fastify({ logger: true, requestIdLogLabel: "reqId" });

fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

fastify.register(db);
fastify.register(libraryRoutes);
fastify.register(lendRoutes);
fastify.register(userRoutes);
fastify.register(returnRoutes);
fastify.register(reservationRoutes);

// Make load balancing visible: stamp the serving instance on every response.
fastify.addHook("onSend", async (_req, reply) => {
  reply.header("X-Served-By", INSTANCE_ID);
});

// Auth gate. Verifies JWT synchronously, returns proper 401/403, and preserves
// the req.body -> { data, user } contract that the route handlers rely on.
fastify.addHook("preHandler", async (req, reply) => {
  const url = req.url.split("?")[0];
  if (unauthorizedRoutes.includes(url)) return;

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) {
    return reply.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Provide a valid JWT token" });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT as string);
  } catch {
    return reply.code(401).send({ statusCode: 401, error: "Unauthorized", message: "JWT token malformed or expired" });
  }

  const user = decoded.user;
  const role = user?.role;
  if (adminRoutes.includes(url) && role !== "admin") {
    return reply.code(403).send({ statusCode: 403, error: "Forbidden", message: "Admin access required" });
  }

  req.body = Object.assign({}, { data: req.body }, { user });
});

fastify.get("/healthcheck", async (req) => ({ status: "OK", servedBy: INSTANCE_ID, host: req.hostname }));

const port = Number(process.env.PORT) || 3001;
fastify.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  fastify.log.info(`[${INSTANCE_ID}] server listening at ${address}`);
});
