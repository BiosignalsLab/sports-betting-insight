import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["test/suite/**/*.test.ts"],
    environment: "node",
  },
});
