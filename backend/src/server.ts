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
import { errorHandler } from "./validation";
import fp from "fastify-plugin";

dotenv.config();

const INSTANCE_ID = process.env.INSTANCE_ID || "backend";

// coerceTypes: false — a number/array sent for a string field must be rejected
// (400), not silently converted.
const fastify = Fastify({
  logger: true,
  requestIdLogLabel: "reqId",
  ajv: { customOptions: { coerceTypes: false } },
});

// Schema-validation failures → 400 with the standard { status, data, message } envelope.
fastify.setErrorHandler(errorHandler);

// Auth gate. Runs in onRequest (before body parsing and schema validation) so
// unauthenticated / unauthorised callers always get 401/403, never a 400.
// Verifies the JWT, requires a usable `user` claim (a missing userId would
// otherwise reach TypeORM as an undefined where-condition, which TypeORM drops),
// and for admin routes checks the CURRENT role in the database, so a demoted
// admin loses access immediately rather than when their token expires.
const authGate = fp(async (app: any) => {
  app.decorateRequest("authUser", null);

  app.addHook("onRequest", async (req: any, reply) => {
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

    const user = decoded?.user;
    if (!user || typeof user !== "object" || typeof user.userId !== "string" || !user.userId) {
      return reply.code(401).send({ statusCode: 401, error: "Unauthorized", message: "JWT token carries no valid user" });
    }

    if (adminRoutes.includes(url)) {
      const current = await app.db.userrecords.findOne({ where: { userId: user.userId } });
      if (current?.role !== "admin") {
        return reply.code(403).send({ statusCode: 403, error: "Forbidden", message: "Admin access required" });
      }
    }

    req.authUser = user;
  });

  // Preserve the req.body -> { data, user } contract that the route handlers rely on.
  // (Runs after schema validation, which therefore sees the raw client body.)
  app.addHook("preHandler", async (req: any) => {
    const url = req.url.split("?")[0];
    if (unauthorizedRoutes.includes(url)) return;
    req.body = Object.assign({}, { data: req.body }, { user: req.authUser });
  });
});

fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

fastify.register(db);
// The gate is registered as a (non-encapsulated) plugin AFTER cors and db, so
// CORS preflights are answered first and fastify.db is available to it.
fastify.register(authGate);
fastify.register(libraryRoutes);
fastify.register(lendRoutes);
fastify.register(userRoutes);
fastify.register(returnRoutes);
fastify.register(reservationRoutes);

// Make load balancing visible: stamp the serving instance on every response.
fastify.addHook("onSend", async (_req, reply) => {
  reply.header("X-Served-By", INSTANCE_ID);
});

fastify.get("/healthcheck", async (req) => ({ status: "OK", servedBy: INSTANCE_ID, host: req.hostname }));

const port = Number(process.env.PORT) || 3001;
fastify.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  fastify.log.info(`[${INSTANCE_ID}] server listening at ${address}`);
});
