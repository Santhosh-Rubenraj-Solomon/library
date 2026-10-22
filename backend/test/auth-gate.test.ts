import { describe, it, expect, beforeAll } from "vitest";
import * as jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";
import { getApp, tokenFor, auth, alice, admin } from "./helpers/app";
import { fakeDb } from "./helpers/fake-db";

let app: FastifyInstance;
beforeAll(async () => {
  app = await getApp();
});

describe("server bootstrap", () => {
  it("does not bind a real port in tests (listen is stubbed)", () => {
    expect((app.listen as any).mock).toBeDefined();
  });

  it("GET /healthcheck is public and reports the instance", async () => {
    const res = await app.inject({ method: "GET", url: "/healthcheck" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "OK", servedBy: "backend-test" });
  });

  it("stamps X-Served-By on every response, including errors", async () => {
    const ok = await app.inject({ method: "GET", url: "/healthcheck" });
    const denied = await app.inject({ method: "GET", url: "/getusers" });
    expect(ok.headers["x-served-by"]).toBe("backend-test");
    expect(denied.statusCode).toBe(401);
    expect(denied.headers["x-served-by"]).toBe("backend-test");
  });

  it("answers CORS preflight requests", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/lendbook",
      headers: {
        origin: "http://localhost:4200",
        "access-control-request-method": "POST",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:4200");
    expect(String(res.headers["access-control-allow-methods"])).toContain("DELETE");
  });
});

describe("auth gate (preHandler)", () => {
  it("lets public routes through without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/getallbooks" });
    expect(res.statusCode).toBe(200);
  });

  it("ignores the query string when matching public routes", async () => {
    const res = await app.inject({ method: "GET", url: "/getallbooks?page=2" });
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 when no Authorization header is sent", async () => {
    const res = await app.inject({ method: "GET", url: "/getbookbyquery?genre=x" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ statusCode: 401, error: "Unauthorized", message: "Provide a valid JWT token" });
  });

  it("returns 401 for a malformed token", async () => {
    const res = await app.inject({ method: "GET", url: "/myreservations", headers: { authorization: "Bearer not.a.jwt" } });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("JWT token malformed or expired");
  });

  it("returns 401 for a token signed with another secret", async () => {
    const token = tokenFor(alice, {}, "some-other-secret");
    const res = await app.inject({ method: "GET", url: "/myreservations", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const token = jwt.sign({ user: alice, exp: Math.floor(Date.now() / 1000) - 60 }, "test-secret");
    const res = await app.inject({ method: "GET", url: "/myreservations", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("JWT token malformed or expired");
  });

  it("accepts a valid 'Bearer <token>' header", async () => {
    const res = await app.inject({ method: "GET", url: "/myreservations", headers: auth(alice) });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("SUCCESS");
  });

  it("accepts a bare token without the Bearer prefix (documented in BUILD_SPEC)", async () => {
    const res = await app.inject({ method: "GET", url: "/myreservations", headers: { authorization: tokenFor(alice) } });
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 when a user-role token hits an admin route", async () => {
    for (const [method, url] of [
      ["POST", "/postnewbook"],
      ["PUT", "/updatebook"],
      ["DELETE", "/deletebook?bookName=x"],
      ["GET", "/getusers"],
      ["POST", "/setrole"],
      ["GET", "/getreservations"],
      ["GET", "/getlendedbooks"],
      ["GET", "/getreturnedbooks"],
    ] as const) {
      const res = await app.inject({ method, url, headers: auth(alice), payload: method === "GET" || method === "DELETE" ? undefined : {} });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json()).toEqual({ statusCode: 403, error: "Forbidden", message: "Admin access required" });
    }
  });

  it("returns 403 on admin routes when the token carries no user claim", async () => {
    const res = await app.inject({ method: "GET", url: "/getusers", headers: { authorization: `Bearer ${tokenFor(undefined)}` } });
    expect(res.statusCode).toBe(403);
  });

  it("lets an admin token through to admin routes", async () => {
    fakeDb.userrecords.seed({ mailId: "x@y.z", role: "user" });
    const res = await app.inject({ method: "GET", url: "/getusers", headers: auth(admin) });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("SUCCESS");
  });

  it("wraps the client body into { data, user } for protected routes", async () => {
    // /reservebook echoes data.bookName back in its error message, and uses user from the token.
    const res = await app.inject({
      method: "POST",
      url: "/reservebook",
      headers: auth(alice),
      payload: { bookName: "Wrapped Body" },
    });
    expect(res.json().message).toBe("The book Wrapped Body is not in the library.");
  });

  it("ignores a client-supplied `user` in the body — identity comes only from the JWT", async () => {
    fakeDb.library.seed({ bookName: "Dune", authorName: "Herbert", language: "EN", genre: "SF", donatedBy: "d" });
    const res = await app.inject({
      method: "POST",
      url: "/lendbook",
      headers: auth(alice),
      payload: { bookName: "Dune", lendDate: "2025-01-01", user: { userId: "u-bob", mailId: "bob@example.com" }, userId: "u-bob" },
    });
    expect(res.json().status).toBe("SUCCESS");
    expect(res.json().data).toMatchObject({ userId: alice.userId, mailId: alice.mailId });
  });

  it("requires auth even for unknown routes (gate runs before the 404 handler)", async () => {
    const res = await app.inject({ method: "GET", url: "/does-not-exist" });
    expect(res.statusCode).toBe(401);
    const authed = await app.inject({ method: "GET", url: "/does-not-exist", headers: auth(alice) });
    expect(authed.statusCode).toBe(404);
  });

  it("returns 500 when a valid token without a `user` claim hits /myreservations (no guard on req.body.user)", async () => {
    // Robustness gap: handler dereferences user.userId outside any try/catch.
    const res = await app.inject({ method: "GET", url: "/myreservations", headers: { authorization: `Bearer ${tokenFor(undefined)}` } });
    expect(res.statusCode).toBe(500);
  });
});
