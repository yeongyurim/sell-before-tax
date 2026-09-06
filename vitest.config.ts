import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  esbuild: { jsx: "automatic" },
  test: {
    // 화면 테스트는 파일 상단의 `@vitest-environment jsdom` 주석으로 전환한다.
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.tsx", "components/**/*.test.tsx"],
  },
});
