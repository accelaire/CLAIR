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
  },
});
