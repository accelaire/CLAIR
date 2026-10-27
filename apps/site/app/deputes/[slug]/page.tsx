import { ParlementaireFicheScreen } from "@clair/screens";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd.tsx";
import {
  chargerFicheOu404,
  metadonneesFiche,
  type SearchParams,
} from "../../_parlementaires/chargement.ts";
import { jsonLdFiche } from "../../_parlementaires/json-ld.ts";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export const generateMetadata = async ({ params }: Props): Promise<Metadata> =>
  metadonneesFiche("assemblee", (await params).slug);

const Page = async ({ params, searchParams }: Props) => {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const initialData = await chargerFicheOu404("assemblee", slug, query);
  return (
    <>
      {initialData.fiche ? (
        <JsonLd data={jsonLdFiche("assemblee", initialData.fiche.data)} />
      ) : null}
      <ParlementaireFicheScreen
        chambre="assemblee"
        slug={slug}
        params={query}
        initialData={initialData}
      />
    </>
  );
};

export default Page;
