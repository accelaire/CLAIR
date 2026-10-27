import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/env.ts";

/** Tant que le site est en bêta, aucun robot ne l'indexe. */
const robots = (): MetadataRoute.Robots =>
  INDEXABLE
    ? { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` }
    : { rules: { userAgent: "*", disallow: "/" } };

export default robots;
