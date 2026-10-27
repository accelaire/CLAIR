import type { Chambre, ParlementaireDetail } from "@clair/data";
import { filArianeJsonLd, parlementaireJsonLd } from "@clair/screens";
import { SITE_URL } from "@/lib/env.ts";

const RUBRIQUES: Record<Chambre, { nom: string; chemin: string }> = {
  assemblee: { nom: "Députés", chemin: "/deputes" },
  senat: { nom: "Sénateurs", chemin: "/senateurs" },
};

/** Données structurées d'une fiche : la personne (`Person`) et son fil d'Ariane. */
export const jsonLdFiche = (chambre: Chambre, fiche: ParlementaireDetail) => {
  const rubrique = RUBRIQUES[chambre];
  return [
    parlementaireJsonLd(SITE_URL, fiche, chambre),
    filArianeJsonLd(SITE_URL, [
      rubrique,
      { nom: `${fiche.prenom} ${fiche.nom}`, chemin: `${rubrique.chemin}/${fiche.slug}` },
    ]),
  ];
};
