import type { ApercuSenatoriales } from "@clair/data";
import { serverApi } from "@/lib/api-server.ts";
import { imageOg, OG_SIZE, OgPage, ogNombre } from "./_og/og.tsx";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = OG_SIZE;
export const alt =
  "Sénatoriales du 27 septembre 2026 : les candidats et le bilan des sortants — CLAIR.vote";

/** Pré-généré et revalidé à l'heure : l'aperçu existe avant le premier partage. */
export const revalidate = 3600;

/**
 * Aperçu social du scrutin. Les chiffres des candidatures sont lus par l'API ; sans réponse, on
 * retombe sur les seuls chiffres fixés par le décret de convocation (l'aperçu ne doit pas casser).
 */
const Image = async () => {
  let apercu: ApercuSenatoriales | null = null;
  try {
    apercu = await serverApi().get<ApercuSenatoriales>("/senatoriales/2026");
  } catch {
    apercu = null;
  }
  const nbSieges = apercu?.scrutin.nbSieges ?? 178;
  const nbCirconscriptions = apercu?.scrutin.nbCirconscriptions ?? 64;
  const candidatures = apercu?.candidatures ?? null;

  return imageOg(
    <OgPage
      badge="Élection"
      badgeColor="#f43f5e"
      surtitre="Dimanche 27 septembre 2026"
      titre="Sénatoriales 2026"
      sousTitre={
        candidatures
          ? `Les candidats en lice, et le bilan des ${nbSieges} sortants`
          : `Le bilan de mandature des ${nbSieges} sénateurs sortants`
      }
      stats={
        candidatures
          ? [
              { label: "Candidats", value: ogNombre(candidatures.candidats) },
              { label: "Listes", value: ogNombre(candidatures.listes) },
              { label: "Sièges renouvelés", value: String(nbSieges) },
              { label: "Circonscriptions", value: String(nbCirconscriptions) },
            ]
          : [
              { label: "Sièges renouvelés", value: String(nbSieges) },
              { label: "Circonscriptions", value: String(nbCirconscriptions) },
              { label: "Sénat", value: "348 sièges" },
            ]
      }
    />,
  );
};

export default Image;
