/**
 * Retransmissions en direct du jour (reprise de `/api/live-now` de apps/web). Route du site, pas
 * de l'API : placée sous `/api/v1` pour que les écrans la lisent par `@clair/api-client`
 * (`useApiQuery("/agenda/direct")`), comme le reste des données. Plus précise que le proxy
 * `[...path]`, elle passe avant lui. Si l'API sert un jour ce chemin, supprimer ce fichier suffit.
 * Cache edge de cinq minutes (une minute si une source a échoué entièrement).
 */
import { chargerDirects } from "@/lib/directs.ts";

export const dynamic = "force-dynamic";

export const GET = async () => {
  try {
    const directs = await chargerDirects();
    return Response.json(directs, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[directs] échec", error);
    return Response.json(
      { commissions: [], seances: [] },
      { headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  }
};
