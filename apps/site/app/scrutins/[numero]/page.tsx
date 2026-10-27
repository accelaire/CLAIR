import type { ScrutinDetail } from "@clair/data";
import {
  filArianeJsonLd,
  parseScrutinFicheParams,
  ScrutinFicheScreen,
  scrutinApiQuery,
  scrutinHref,
  scrutinJsonLd,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchResource } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ numero: string }>; searchParams: Promise<SearchParams> };

/** Réponse brute : elle porte aussi la donnée source complète, inutile au navigateur. */
type ScrutinBrut = ScrutinDetail & { sourceData?: unknown; sourceHash?: unknown };

/**
 * Scrutin identifié par son numéro, sa chambre et sa session (le numéro seul est ambigu : sans
 * session, l'API résout vers le plus récent). `null` si le numéro est invalide ou inconnu.
 */
const loadScrutin = cache(
  async (numero: string, chambre: string, session: string): Promise<ScrutinDetail | null> => {
    if (!/^\d{1,6}$/.test(numero) || Number(numero) <= 0) return null;
    const response = await fetchResource<{ data: ScrutinBrut }>(
      `/scrutins/${numero}`,
      scrutinApiQuery(parseScrutinFicheParams({ chambre, session })),
    );
    if (!response?.data) return null;
    const { sourceData: _sourceData, sourceHash: _sourceHash, ...scrutin } = response.data;
    return scrutin;
  },
);

const load = async ({ params, searchParams }: Props) => {
  const { numero } = await params;
  const query = parseScrutinFicheParams(await searchParams);
  return loadScrutin(numero, query.chambre, query.session);
};

const sortLabel = (sort: string) =>
  /adopt/i.test(sort) ? "Adopté" : /rejet/i.test(sort) ? "Rejeté" : sort;

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const scrutin = await load(props);
  if (!scrutin) return {};
  const chambre = scrutin.chambre === "senat" ? "Sénat" : "Assemblée nationale";
  const title = `Scrutin n°${scrutin.numero} — ${scrutin.titre}`;
  const description = `${chambre} — ${sortLabel(scrutin.sort)} (${scrutin.nombrePour} pour, ${scrutin.nombreContre} contre, ${scrutin.nombreAbstention} abstentions). ${scrutin.titre}`;
  // Adresse canonique : toujours la chambre et la session, le numéro n'étant unique nulle part.
  const canonical = scrutinHref(scrutin);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
};

const Page = async (props: Props) => {
  const scrutin = await load(props);
  if (!scrutin) notFound();
  const chemin = scrutinHref(scrutin);
  return (
    <>
      <JsonLd
        data={[
          scrutinJsonLd(scrutin, `${SITE_URL}${chemin}`),
          filArianeJsonLd(SITE_URL, [
            { nom: "Scrutins", chemin: "/scrutins" },
            { nom: `Scrutin n°${scrutin.numero}`, chemin },
          ]),
        ]}
      />
      <ScrutinFicheScreen
        numero={scrutin.numero}
        params={await props.searchParams}
        initialData={{ data: scrutin }}
      />
    </>
  );
};

export default Page;
