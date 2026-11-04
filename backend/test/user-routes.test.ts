import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import * as jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";
import { getApp, auth, admin, alice, seedAdmin } from "./helpers/app";
import { fakeDb } from "./helpers/fake-db";

let app: FastifyInstance;
beforeAll(async () => {
  app = await getApp();
});

const signin = (payload?: any) => app.inject({ method: "POST", url: "/usersignin", payload });
const decode = (token: string) => jwt.verify(token, "test-secret") as any;

describe("POST /usersignin", () => {
  it("creates a new user with role 'user' and returns a JWT in data", async () => {
    const res = await signin({ mailId: "new@example.com" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("SUCCESS");
    expect(typeof body.data).toBe("string");

    const payload = decode(body.data);
    expect(payload.user).toMatchObject({ mailId: "new@example.com", role: "user" });
    expect(payload.user.userId).toEqual(expect.any(String));
    expect(payload.exp - payload.iat).toBe(86400);

    expect(fakeDb.userrecords.rows).toHaveLength(1);
    expect(fakeDb.userrecords.rows[0]).toMatchObject({ mailId: "new@example.com", role: "user", visitCount: 0 });
  });

  it("does not create a duplicate on repeat sign-in and increments visitCount", async () => {
    await signin({ mailId: "repeat@example.com" });
    await signin({ mailId: "repeat@example.com" });
    await signin({ mailId: "repeat@example.com" });
    expect(fakeDb.userrecords.rows).toHaveLength(1);
    expect(fakeDb.userrecords.rows[0].visitCount).toBe(2);
  });

  it("mints a token with the stored role for an existing (seeded) admin", async () => {
    fakeDb.userrecords.seed({ mailId: admin.mailId, role: "admin" });
    const res = await signin({ mailId: admin.mailId });
    expect(decode(res.json().data).user.role).toBe("admin");
  });

  it("returned token is accepted by protected routes", async () => {
    const token = (await signin({ mailId: "flow@example.com" })).json().data;
    const res = await app.inject({ method: "GET", url: "/myreservations", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
  });

  it("performs no email validation (any string is accepted)", async () => {
    const res = await signin({ mailId: "not-an-email" });
    expect(res.json().status).toBe("SUCCESS");
  });

  it.each([
    ["an empty body", {}],
    ["no body at all", undefined],
    ["a blank mailId", { mailId: "   " }],
    ["a non-string mailId", { mailId: 42 }],
    ["an object mailId", { mailId: { $ne: "" } }],
  ])("rejects sign-in with %s (400, no token, never matches a stored user)", async (_label, payload) => {
    // An undefined where-condition is dropped by TypeORM 0.3, which used to
    // return the FIRST stored user (possibly the admin) for an empty body.
    fakeDb.userrecords.seed({ userId: "u-admin", mailId: admin.mailId, role: "admin" });
    const res = await signin(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ status: "ERROR", data: null, message: "Invalid Input : Provide a mailId" });
    expect(fakeDb.userrecords.rows).toHaveLength(1);
    expect(fakeDb.userrecords.rows[0].visitCount).toBe(0);
  });

  it("returns 500 when the JWT secret is not configured", async () => {
    const prev = process.env.JWT;
    delete process.env.JWT;
    try {
      const res = await signin({ mailId: "nosecret@example.com" });
      expect(res.statusCode).toBe(500);
    } finally {
      process.env.JWT = prev;
    }
  });
});

describe("GET /getusers (admin)", () => {
  it("lists all users", async () => {
    await seedAdmin();
    fakeDb.userrecords.seed({ mailId: "a@x.io", role: "user" });
    fakeDb.userrecords.seed({ mailId: "b@x.io", role: "admin" });
    const res = await app.inject({ method: "GET", url: "/getusers", headers: auth(admin) });
    const body = res.json();
    expect(body.status).toBe("SUCCESS");
    expect(body.data.map((u: any) => u.mailId)).toEqual([admin.mailId, "a@x.io", "b@x.io"]);
    expect(body.message).toBe("The Users fetched Successfully");
  });

  it("returns the standard envelope with an empty list when there are no users", async () => {
    // The admin check reads the DB, so stub an empty table for the listing call only.
    const realFind = fakeDb.userrecords.find.bind(fakeDb.userrecords);
    await seedAdmin();
    fakeDb.userrecords.find = async () => [];
    try {
      const res = await app.inject({ method: "GET", url: "/getusers", headers: auth(admin) });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "SUCCESS", data: [], message: "No Users found" });
    } finally {
      fakeDb.userrecords.find = realFind;
    }
  });
});

describe("POST /setrole (admin)", () => {
  const setrole = (payload: any, user = admin) =>
    app.inject({ method: "POST", url: "/setrole", headers: auth(user), payload });
  beforeEach(async () => {
    await seedAdmin();
  });

  it("rejects non-admins with 403 at the gate", async () => {
    const res = await setrole({ mailId: "a@x.io", role: "admin" }, alice);
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 when mailId is missing", async () => {
    const res = await setrole({ role: "admin" });
    expect(res.statusCode).toBe(400);
    expect(res.json().status).toBe("ERROR");
  });

  it("returns 400 for an unknown role", async () => {
    const res = await setrole({ mailId: "a@x.io", role: "superuser" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when trying to demote the primary admin", async () => {
    const res = await setrole({ mailId: "santhoshrubenc@gmail.com", role: "user" });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe("The primary admin cannot be demoted.");
  });

  it("returns 404 for an unknown user", async () => {
    const res = await setrole({ mailId: "ghost@x.io", role: "admin" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ status: "ERROR", message: "User not found." });
  });

  it("promotes a user to admin and returns the updated record", async () => {
    fakeDb.userrecords.seed({ mailId: "promote@x.io", role: "user" });
    const res = await setrole({ mailId: "promote@x.io", role: "admin" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "SUCCESS",
      data: { mailId: "promote@x.io", role: "admin" },
      message: "promote@x.io is now admin.",
    });
    expect(fakeDb.userrecords.rows.find((u) => u.mailId === "promote@x.io")!.role).toBe("admin");
  });

  it("demotes an admin to user", async () => {
    fakeDb.userrecords.seed({ mailId: "demote@x.io", role: "admin" });
    const res = await setrole({ mailId: "demote@x.io", role: "user" });
    expect(res.json().data.role).toBe("user");
  });

  it("allows (re)affirming the primary admin as admin", async () => {
    fakeDb.userrecords.seed({ mailId: "santhoshrubenc@gmail.com", role: "admin" });
    const res = await setrole({ mailId: "santhoshrubenc@gmail.com", role: "admin" });
    expect(res.statusCode).toBe(200);
  });

  it("a demoted admin loses admin access immediately, even with an unexpired admin token", async () => {
    const demoted = { userId: "u-d", mailId: "demoted@x.io", role: "admin" };
    fakeDb.userrecords.seed({ ...demoted });
    expect((await app.inject({ method: "GET", url: "/getusers", headers: auth(demoted) })).statusCode).toBe(200);
    await setrole({ mailId: demoted.mailId, role: "user" });
    const res = await app.inject({ method: "GET", url: "/getusers", headers: auth(demoted) });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ statusCode: 403, error: "Forbidden", message: "Admin access required" });
  });

  it("an admin-role token for a user that no longer exists is rejected on admin routes", async () => {
    const ghost = { userId: "u-ghost", mailId: "ghost-admin@x.io", role: "admin" };
    const res = await app.inject({ method: "GET", url: "/getusers", headers: auth(ghost) });
    expect(res.statusCode).toBe(403);
  });
});
