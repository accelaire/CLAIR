import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/env.ts";

/**
 * Tant que le site est en bêta, aucun robot ne l'indexe. Une fois indexable, mêmes règles que
 * apps/web : le proxy `/api/` (et `/admin/`) exclus ; la page `/api`, sans barre finale, reste
 * indexée. Ne jamais bloquer `/_next/` : Googlebot a besoin du CSS et du JS qui y sont servis.
 */
const robots = (): MetadataRoute.Robots =>
  INDEXABLE
    ? {
        rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] },
        sitemap: `${SITE_URL}/sitemap.xml`,
      }
    : { rules: { userAgent: "*", disallow: "/" } };

export default robots;
