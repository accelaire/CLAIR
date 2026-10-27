import {
  accorde,
  CirconscriptionScreen,
  directCirconscription,
  filArianeJsonLd,
  locutionDepuisCode,
  modeDeScrutin,
  pluriel,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd.tsx";
import { SITE_URL } from "@/lib/env.ts";
import {
  chargerCirconscription,
  chargerListesCirconscription,
  chargerResultatsCirconscription,
  urlAbsolue,
} from "../_chargement.ts";
import { election, sortantsJsonLd } from "../_json-ld.ts";
import { ActualisationDirect } from "../ActualisationDirect.tsx";

/**
 * Une page par circonscription, revalidée chaque minute depuis qu'elle porte les résultats (les
 * autres appels gardent leur cache d'une heure). Rendue à la première visite plutôt qu'au build,
 * pour que le build ne dépende pas de l'API.
 */
export const revalidate = 60;

/** Aucune page au build (le build ne dépend pas de l'API) ; chacune est mise en cache à sa première visite. */
export const generateStaticParams = () => [];

type Props = { params: Promise<{ departement: string }> };

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { departement } = await params;
  const trouvee = await chargerCirconscription(departement);
  if (!trouvee) return {};
  const circo = trouvee.circonscription;
  const url = `/senatoriales-2026/${departement}`;
  const ou = locutionDepuisCode(circo.code, circo.nom);

  // Une fois les premiers résultats publiés, le titre et la description disent ce que la page
  // montre désormais ; sans rien promettre avant.
  const resultats = await chargerResultatsCirconscription(circo.code);
  if (resultats && resultats.tours.length > 0) {
    const titre = `Sénatoriales 2026 — ${circo.nom} : résultats et élus`;
    const description =
      `Résultats des sénatoriales du 27 septembre 2026 ${ou} : ` +
      `${resultats.circonscription.modeScrutin === "proportionnel" ? "les voix et les sièges par liste" : "les voix par candidat"}, ` +
      "les élus, la participation des grands électeurs, et le bilan de mandature de chaque sénateur sortant.";
    return {
      title: titre,
      description,
      alternates: { canonical: url },
      openGraph: { title: titre, description, url, type: "article" },
      twitter: { card: "summary_large_image", title: titre, description },
    };
  }

  const titre = `Sénatoriales 2026 — ${circo.nom} : ${circo.nbSieges} ${pluriel(circo.nbSieges, "siège")} à pourvoir`;
  const candidats =
    circo.nbCandidats && circo.nbCandidats > 0
      ? `Les ${circo.nbCandidats} candidats en lice, et le bilan de mandature`
      : "Présence, loyauté, interventions et amendements : le bilan de mandature";
  const description =
    `Le 27 septembre 2026, ${circo.nbSieges} ${pluriel(circo.nbSieges, "siège")} de sénateur ` +
    `${accorde(circo.nbSieges, "est renouvelé", "sont renouvelés")} ${ou}, au scrutin ` +
    `${modeDeScrutin(circo.nbSieges).court}. ${candidats} de chaque sénateur sortant.`;
  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: { title: titre, description, url, type: "article" },
    twitter: { card: "summary_large_image", title: titre, description },
  };
};

const Page = async ({ params }: Props) => {
  const { departement } = await params;
  const trouvee = await chargerCirconscription(departement);
  // Slug inconnu, ou circonscription absente de la réponse de l'API : pas de page vide indexable.
  if (!trouvee) notFound();
  const { apercu, circonscription } = trouvee;
  const { code, nom, nbSieges } = circonscription;

  const [{ sortants, candidats }, resultats] = await Promise.all([
    chargerListesCirconscription(code),
    chargerResultatsCirconscription(code),
  ]);
  const url = urlAbsolue(`/senatoriales-2026/${departement}`);
  const ou = locutionDepuisCode(code, nom);
  const liste = sortants?.data ?? [];

  return (
    <>
      <JsonLd
        data={[
          filArianeJsonLd(SITE_URL, [
            { nom: "Sénatoriales 2026", chemin: "/senatoriales-2026" },
            { nom, chemin: `/senatoriales-2026/${departement}` },
          ]),
          election({
            name: `Élections sénatoriales 2026 — ${nom}`,
            description: `Renouvellement de ${nbSieges} ${pluriel(nbSieges, "siège")} de sénateur ${ou}, au scrutin ${modeDeScrutin(nbSieges).court}.`,
            url,
            location: nom,
          }),
          ...(liste.length > 0 ? [sortantsJsonLd(nom, liste)] : []),
        ]}
      />
      {directCirconscription(resultats) ? <ActualisationDirect /> : null}
      <CirconscriptionScreen
        circonscription={{ code, nom, nbSieges }}
        nbCirconscriptions={apercu.circonscriptions.length || apercu.scrutin.nbCirconscriptions}
        initialData={{ sortants, candidats }}
        resultats={resultats}
        maintenant={resultats?.maintenant ?? new Date().toISOString()}
      />
    </>
  );
};

export default Page;
