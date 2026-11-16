import { vitestFront } from "@clair/config/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

// Seuils de couverture (`pnpm test:coverage`) : juste sous le niveau mesuré le 16/11/2026, à remonter, jamais à baisser.
export default mergeConfig(
  vitestFront,
  defineConfig({
    test: {
      environment: "node",
      coverage: { thresholds: { statements: 80, branches: 95, functions: 80, lines: 80 } },
    },
  }),
);
