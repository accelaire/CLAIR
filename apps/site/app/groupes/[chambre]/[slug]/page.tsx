import { type ApiData, CHAMBRES, type Chambre, type GroupeDetail } from "@clair/data";
import {
  filArianeJsonLd,
  GroupeFicheScreen,
  groupeJsonLd,
  parseGroupeFicheParams,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchResource } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

export const revalidate = 3600;

type Props = {
  params: Promise<{ chambre: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const estChambre = (valeur: string): valeur is Chambre =>
  valeur === "assemblee" || valeur === "senat";

/**
 * Un sigle désigne un groupe différent selon la législature (AN) ou la session (Sénat) : la
 * période fait partie de la requête, sans elle l'API renvoie la plus récente.
 */
const chargerGroupe = cache(
  (chambre: Chambre, slug: string, legislature: string, session: string) =>
    fetchResource<ApiData<GroupeDetail>>(`/groupes/${chambre}/${encodeURIComponent(slug)}`, {
      ...(legislature ? { legislature } : {}),
      ...(session ? { session } : {}),
    }),
);

const lire = async ({ params, searchParams }: Props) => {
  const { chambre, slug } = await params;
  const etat = parseGroupeFicheParams(await searchParams);
  if (!estChambre(chambre)) return null;
  const reponse = await chargerGroupe(chambre, slug, etat.legislature, etat.session);
  return reponse ? { chambre, slug, reponse } : null;
};

/** Adresse canonique : elle porte la période, sans quoi plusieurs compositions la partageraient. */
const canonique = (groupe: GroupeDetail) => {
  const base = `/groupes/${groupe.chambre}/${groupe.slug}`;
  if (groupe.legislature !== null) return `${base}?legislature=${groupe.legislature}`;
  if (groupe.session && !groupe.sessionCourante) return `${base}?session=${groupe.session}`;
  return base;
};

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const groupe = (await lire(props))?.reponse.data;
  if (!groupe) return {};
  const chambre = CHAMBRES[groupe.chambre].nom;
  const nom = groupe.nomComplet || groupe.nom;
  const title = `${nom} — ${chambre}`;
  const preposition = groupe.chambre === "senat" ? "au Sénat" : "à l'Assemblée nationale";
  const description = `Groupe ${nom} ${preposition}. ${groupe.membresActifsCount} membres. Votes, positions et statistiques sur CLAIR.vote.`;
  const url = canonique(groupe);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
};

const Page = async (props: Props) => {
  const fiche = await lire(props);
  if (!fiche) notFound();
  const groupe = fiche.reponse.data;
  return (
    <>
      <JsonLd
        data={[
          groupeJsonLd(SITE_URL, groupe),
          filArianeJsonLd(SITE_URL, [
            { nom: "Groupes politiques", chemin: "/groupes" },
            {
              nom: groupe.nomComplet || groupe.nom,
              chemin: `/groupes/${groupe.chambre}/${groupe.slug}`,
            },
          ]),
        ]}
      />
      <GroupeFicheScreen
        chambre={fiche.chambre}
        slug={fiche.slug}
        params={await props.searchParams}
        initialData={fiche.reponse}
      />
    </>
  );
};

export default Page;
