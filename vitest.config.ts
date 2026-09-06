import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.tsx", "components/**/*.test.tsx"],
    environmentMatchGlobs: [
      ["lib/**", "node"],
      ["**/*.test.tsx", "jsdom"],
    ],
  },
});
