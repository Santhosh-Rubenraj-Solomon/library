/**
 * Global test setup.
 *
 * - Sets a JWT secret before src/server.ts is imported.
 * - Replaces src/db.ts (which would connect to Postgres) with a plugin that
 *   decorates `fastify.db` with in-memory fake repositories.
 * - Wraps the `fastify` factory so src/server.ts never binds a port: `listen`
 *   becomes a no-op and the created instance is exposed for `app.inject()`.
 * - Silences the very chatty console.log calls in the route handlers.
 */
import { vi, beforeEach } from "vitest";

process.env.TZ = "UTC";
process.env.JWT = "test-secret";
process.env.INSTANCE_ID = "backend-test";

vi.mock("../src/db", async () => {
  const fp = (await import("fastify-plugin")).default;
  const { fakeDb } = await import("./helpers/fake-db");
  return {
    default: fp(async (server: any) => {
      server.decorate("db", fakeDb);
    }),
  };
});

vi.mock("fastify", async (importOriginal) => {
  const real: any = await importOriginal();
  const realFactory = real.default ?? real;
  const factory = (opts: any = {}) => {
    const app = realFactory({ ...opts, logger: false });
    app.listen = vi.fn();
    (globalThis as any).__testApp = app;
    return app;
  };
  return { ...real, default: factory };
});

vi.spyOn(console, "log").mockImplementation(() => {});

beforeEach(async () => {
  const { resetFakeDb } = await import("./helpers/fake-db");
  resetFakeDb();
});
