import * as jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";

/** Imports the real src/server.ts (with the mocks from test/setup.ts) and returns the ready app. */
export async function getApp(): Promise<FastifyInstance> {
  await import("../../src/server");
  const app = (globalThis as any).__testApp as FastifyInstance;
  if (!app) throw new Error("server.ts did not create a Fastify instance");
  await app.ready();
  return app;
}

export interface TestUser {
  userId: string;
  mailId: string;
  role: string;
}

export const alice: TestUser = { userId: "u-alice", mailId: "alice@example.com", role: "user" };
export const bob: TestUser = { userId: "u-bob", mailId: "bob@example.com", role: "user" };
export const carol: TestUser = { userId: "u-carol", mailId: "carol@example.com", role: "user" };
export const admin: TestUser = { userId: "u-admin", mailId: "admin@surflibrary.dev", role: "admin" };

export function tokenFor(user: Partial<TestUser> | undefined, opts: jwt.SignOptions = {}, secret = "test-secret") {
  return jwt.sign(user === undefined ? { foo: "bar" } : { user }, secret, { expiresIn: "1h", ...opts });
}

export function auth(user: Partial<TestUser>) {
  return { authorization: `Bearer ${tokenFor(user)}` };
}
