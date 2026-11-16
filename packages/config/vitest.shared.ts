import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Configuration Vitest commune aux packages du front (happy-dom, Testing Library, CSS modules). */
export const vitestFront = defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    // fileURLToPath et non `.pathname` : un chemin avec espaces ou accents reste encodé (%20)
    // dans `.pathname`, et sous Windows il commence par `/C:/`.
    setupFiles: [fileURLToPath(new URL("./vitest.setup.ts", import.meta.url))],
    css: true,
    // `pnpm test:coverage` : couverture du code source, hors stories, tests et fixtures fictives.
    // Les stories ont leur propre mesure, dans le navigateur (apps/storybook).
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.stories.tsx",
        "src/**/*.test.{ts,tsx}",
        "src/**/fixtures.ts",
        "src/**/*.d.ts",
        "src/test-utils.tsx",
        "src/story-utils.ts",
      ],
      reporter: ["text-summary", "json-summary", "html"],
    },
  },
});
