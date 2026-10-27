import { codeDepuisSlug, modeDeScrutin, pluriel } from "@clair/screens";
import { notFound } from "next/navigation";
import { circonscriptionPourImage } from "../_chargement.ts";
import { imageOg, OG_SIZE, OgPage } from "../_og/og.tsx";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = OG_SIZE;
export const revalidate = 3600;

type Props = { params: Promise<{ departement: string }> };

/**
 * Le slug seul décide qu'il y a une image (validé hors réseau) : une API muette ne doit pas
 * supprimer l'`og:image`, seulement dégrader son texte alternatif.
 */
export const generateImageMetadata = async ({ params }: Props) => {
  const { departement } = await params;
  if (!codeDepuisSlug(departement)) return [];
  const trouvee = await circonscriptionPourImage(departement);
  const circo = trouvee?.circonscription;
  return [
    {
      id: departement,
      size: OG_SIZE,
      alt: circo
        ? `Sénatoriales 2026 — ${circo.nom} : ${circo.nbSieges} ${pluriel(circo.nbSieges, "siège")} à pourvoir`
        : "Sénatoriales 2026",
      contentType: "image/png",
    },
  ];
};

/** Aperçu social d'une circonscription ; API muette : repli sur les chiffres du scrutin. */
const Image = async ({ params }: Props) => {
  const { departement } = await params;
  if (!codeDepuisSlug(departement)) notFound();
  const circo = (await circonscriptionPourImage(departement))?.circonscription ?? null;
  const scrutin = circo ? modeDeScrutin(circo.nbSieges) : null;
  const nbCandidats = circo?.nbCandidats ?? 0;
  const nbListes = circo?.nbListes ?? 0;
  const candidaturesPubliees = nbCandidats > 0;

  const pastilles =
    circo && scrutin
      ? [
          ...(candidaturesPubliees
            ? [
                { label: "Candidats", value: String(nbCandidats) },
                {
                  label: pluriel(nbListes, scrutin.unite === "liste" ? "Liste" : "Candidature"),
                  value: String(nbListes),
                },
              ]
            : []),
          {
            label: `${pluriel(circo.nbSieges, "Siège")} à pourvoir`,
            value: String(circo.nbSieges),
          },
          { label: "Scrutin", value: scrutin.bref },
        ]
      : [
          { label: "Sièges renouvelés", value: "178" },
          { label: "Circonscriptions", value: "64" },
        ];

  return imageOg(
    <OgPage
      badge="Sénatoriales 2026"
      badgeColor="#f43f5e"
      surtitre="Dimanche 27 septembre 2026"
      titre={circo ? circo.nom : "Sénatoriales 2026"}
      sousTitre={
        candidaturesPubliees
          ? "Les candidats en lice, et le bilan des sortants"
          : "Le bilan de mandature des sénateurs sortants"
      }
      stats={pastilles}
    />,
  );
};

export default Image;
