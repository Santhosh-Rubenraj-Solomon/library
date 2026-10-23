import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FakeRepository, fakeDb, resetFakeDb } from "./helpers/fake-db";

// Vitest transpiles with esbuild, which does not emit decorator metadata, so the
// real entity would fail TypeORM's column-type inference. The script only uses
// the class as a repository token, so a plain class is enough.
vi.mock("../src/entity/users", () => ({ Users: class Users {} }));

/**
 * src/seed-admin.ts runs on import and ends with process.exit(). We mock the
 * DataSource with the in-memory user repository and capture the exit code.
 */
async function runSeed(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  const ds = {
    isInitialized: false,
    initialize: vi.fn(async () => {
      ds.isInitialized = true;
    }),
    getRepository: vi.fn(() => fakeDb.userrecords as FakeRepository),
    destroy: vi.fn(async () => {}),
  };
  vi.doMock("../src/data-source", () => ({ AppDataSource: ds }));

  const prev = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];

  const exited = new Promise<number>((resolve) => {
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      resolve(code ?? 0);
      return undefined as never;
    }) as any);
  });
  try {
    await import("../src/seed-admin");
    return { code: await exited, ds };
  } finally {
    process.env = prev;
  }
}

describe("seed-admin script", () => {
  beforeEach(() => {
    // vi.resetModules() means the global setup resets a *fresh* fake-db instance,
    // so reset the one this file holds directly.
    resetFakeDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("../src/data-source");
  });

  it("creates the default admin when none exists", async () => {
    const { code, ds } = await runSeed({ ADMIN_EMAIL: undefined });
    expect(code).toBe(0);
    expect(ds.initialize).toHaveBeenCalled();
    expect(ds.destroy).toHaveBeenCalled();
    expect(fakeDb.userrecords.rows).toHaveLength(1);
    expect(fakeDb.userrecords.rows[0]).toMatchObject({ mailId: "admin@surflibrary.dev", role: "admin" });
  });

  it("honours ADMIN_EMAIL", async () => {
    await runSeed({ ADMIN_EMAIL: "boss@example.com" });
    expect(fakeDb.userrecords.rows[0]).toMatchObject({ mailId: "boss@example.com", role: "admin" });
  });

  it("promotes an existing non-admin user instead of duplicating", async () => {
    fakeDb.userrecords.seed({ mailId: "boss@example.com", role: "user", visitCount: 3 });
    const { code } = await runSeed({ ADMIN_EMAIL: "boss@example.com" });
    expect(code).toBe(0);
    expect(fakeDb.userrecords.rows).toHaveLength(1);
    expect(fakeDb.userrecords.rows[0]).toMatchObject({ role: "admin", visitCount: 3 });
  });

  it("is a no-op for an existing admin", async () => {
    fakeDb.userrecords.seed({ mailId: "boss@example.com", role: "admin" });
    const saveSpy = vi.spyOn(fakeDb.userrecords, "save");
    await runSeed({ ADMIN_EMAIL: "boss@example.com" });
    expect(saveSpy).not.toHaveBeenCalled();
    expect(fakeDb.userrecords.rows).toHaveLength(1);
  });

  it("exits with code 1 when the database is unreachable", async () => {
    vi.resetModules();
    vi.doMock("../src/data-source", () => ({
      AppDataSource: {
        isInitialized: false,
        initialize: vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }),
      },
    }));
    const exited = new Promise<number>((resolve) => {
      vi.spyOn(process, "exit").mockImplementation(((c?: number) => {
        resolve(c ?? 0);
        return undefined as never;
      }) as any);
    });
    await import("../src/seed-admin");
    expect(await exited).toBe(1);
  });
});
