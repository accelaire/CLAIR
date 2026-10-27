import {
  directNational,
  filArianeJsonLd,
  parseSenatorialesParams,
  resultatsPublies,
  SenatorialesScreen,
  scrutinCommence,
} from "@clair/screens";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd.tsx";
import { SITE_URL } from "@/lib/env.ts";
import { chargerApercu, chargerResultats, chargerSortants, urlAbsolue } from "./_chargement.ts";
import { election, faq } from "./_json-ld.ts";
import { ActualisationDirect } from "./ActualisationDirect.tsx";

/**
 * Rendu à la demande, comme apps/web : la page lit ses filtres dans l'URL, et le contenu
 * (178 sortants, 64 circonscriptions) doit être dans le HTML servi.
 */
export const dynamic = "force-dynamic";

const title = "Sénatoriales 2026 — les candidats et le bilan des sortants";
const description =
  "Le 27 septembre 2026, 178 des 348 sièges du Sénat sont renouvelés dans 64 circonscriptions. Les candidats circonscription par circonscription, et le bilan de mandature de chaque sénateur sortant : présence, loyauté, interventions, amendements.";

/** Le titre suit ce que la page montre : « résultats » seulement une fois le premier publié. */
export const generateMetadata = async (): Promise<Metadata> => {
  const resultats = await chargerResultats();
  const publies = scrutinCommence(resultats) && resultatsPublies(resultats);
  return {
    title: publies ? "Sénatoriales 2026 — résultats, élus et bilan des sortants" : title,
    description: publies
      ? "Les résultats des sénatoriales du 27 septembre 2026 : 178 des 348 sièges du Sénat renouvelés dans 64 circonscriptions. Les élus, les voix par liste, le Sénat avant et après, et le bilan de mandature de chaque sénateur sortant."
      : description,
    alternates: { canonical: "/senatoriales-2026" },
    openGraph: {
      title: publies
        ? "Sénatoriales 2026 : les résultats — CLAIR.vote"
        : "Sénatoriales du 27 septembre 2026 — CLAIR.vote",
      description: publies
        ? "178 sièges renouvelés, 64 circonscriptions. Les élus, le Sénat avant et après, et le bilan des sortants."
        : "178 sièges renouvelés, 64 circonscriptions. Les candidats, et le bilan de mandature des sénateurs sortants, chiffres à l'appui.",
      url: "/senatoriales-2026",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: publies ? "Sénatoriales 2026 : les résultats" : "Sénatoriales du 27 septembre 2026",
      description: publies
        ? "178 sièges renouvelés, 64 circonscriptions. Les élus et le bilan des sortants."
        : "178 sièges renouvelés, 64 circonscriptions. Les candidats et le bilan de mandature des sortants.",
    },
  };
};

/** Les mêmes questions et réponses que le bloc « Comment fonctionne une élection sénatoriale ? ». */
const QUESTIONS = [
  {
    question: "Qui élit les sénateurs ?",
    reponse:
      "Les sénateurs sont élus au suffrage indirect, par environ 162 000 grands électeurs : députés, conseillers régionaux et départementaux, et surtout délégués des conseils municipaux, qui forment près de 95 % du collège.",
  },
  {
    question: "Combien de sièges sont renouvelés en 2026 ?",
    reponse:
      "Le Sénat se renouvelle par moitié tous les trois ans. Le 27 septembre 2026, c’est la série 2 : 178 sièges sur 348, dans 64 circonscriptions.",
  },
  {
    question: "Quel est le mode de scrutin des élections sénatoriales ?",
    reponse:
      "Le mode de scrutin dépend du département : majoritaire à deux tours là où il y a un ou deux sièges à pourvoir, proportionnel de liste à un tour à partir de trois sièges.",
  },
  {
    question: "Quand les sénateurs élus en 2026 prennent-ils leurs fonctions ?",
    reponse: "Les élus prennent leurs fonctions le 1er octobre 2026, pour un mandat de six ans.",
  },
];

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  const filtres = parseSenatorialesParams(params);
  const [apercu, { sortants, tousSortants }, resultats] = await Promise.all([
    chargerApercu(),
    chargerSortants(filtres),
    chargerResultats(),
  ]);

  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [{ nom: "Sénatoriales 2026", chemin: "/senatoriales-2026" }]),
          election({
            name: "Élections sénatoriales françaises du 27 septembre 2026",
            description,
            url: urlAbsolue("/senatoriales-2026"),
          }),
          faq(QUESTIONS),
        ]}
      />
      {directNational(resultats) ? <ActualisationDirect /> : null}
      <SenatorialesScreen
        params={params}
        initialData={{
          apercu: apercu ?? undefined,
          sortants: sortants ?? undefined,
          tousSortants,
        }}
        resultats={resultats}
      />
    </>
  );
};

export default Page;
