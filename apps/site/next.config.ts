import path from "node:path";
import type { NextConfig } from "next";
import { redirects } from "./lib/redirects.ts";

const config: NextConfig = {
  reactStrictMode: true,
  // Dossier de build configurable : plusieurs builds en parallèle (vérifications, CI) sans conflit.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: [
    "@clair/api-client",
    "@clair/data",
    "@clair/screens",
    "@clair/theme",
    "@clair/ui",
  ],
  experimental: { optimizePackageImports: ["@mantine/core", "@mantine/hooks", "lucide-react"] },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "www2.assemblee-nationale.fr", pathname: "/static/tribun/**" },
      { protocol: "https", hostname: "www.assemblee-nationale.fr", pathname: "/dyn/**" },
      { protocol: "https", hostname: "www.senat.fr", pathname: "/senimg/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
    ],
  },
  redirects: async () => redirects,
};

export default config;
