import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "src/components/index.ts"),
    },
  },
  server: {
    watch: {
      ignored: ["**/.next/**", "**/.venv/**", "**/coverage/**", "**/dist/**"],
    },
    proxy: {
      "/api/v1": {
        target: "https://api.clair.vote",
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: "https://api.clair.vote",
        changeOrigin: true,
        secure: false,
      },
      "/api-proxy": {
        target: "https://api.clair.vote",
        changeOrigin: true,
        secure: false,
        rewrite: (p: string) => p.replace(/^\/api-proxy/, ""),
      },
    },
  },
  ssr: {
    noExternal: ["mermaid", "style-to-js", "style-to-object"],
  },
  optimizeDeps: {
    include: ["mermaid", "style-to-js", "style-to-object"],
    exclude: [
      "virtual:zudoku-api-keys-plugin",
      "virtual:zudoku-api-plugins",
      "virtual:zudoku-auth",
      "virtual:zudoku-config",
      "virtual:zudoku-custom-pages-plugin",
      "virtual:zudoku-docs-plugin",
      "virtual:zudoku-markdown-files",
      "virtual:zudoku-navigation",
      "virtual:zudoku-search-plugin",
      "virtual:zudoku-shiki-register",
      "virtual:zudoku-theme.css",
    ],
  },
});
