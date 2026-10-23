import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // server.ts is a side-effectful module; give every file a fresh module graph.
    isolate: true,
    restoreMocks: false,
  },
});
