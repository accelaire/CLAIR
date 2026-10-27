import { LOBBYISTE_TYPE_LIBELLES, type LobbyisteDetail } from "@clair/data";
import { filArianeJsonLd, LobbyisteFicheScreen, lobbyisteJsonLd } from "@clair/screens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd.tsx";
import { fetchResource } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** L'API n'accepte qu'un UUID (400 sinon) : toute autre adresse est une page inexistante. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPES: Record<string, string> = LOBBYISTE_TYPE_LIBELLES;

/** Un seul appel par rendu pour les métadonnées et la page. */
const loadLobbyiste = cache(async (id: string) =>
  UUID.test(id) ? fetchResource<{ data: LobbyisteDetail }>(`/lobbying/${id}`) : null,
);

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { id } = await params;
  const lobbyiste = (await loadLobbyiste(id))?.data;
  if (!lobbyiste) return {};
  const title = `${lobbyiste.nom} — Lobbying`;
  const nbActions = lobbyiste.actions.length;
  const description = [
    lobbyiste.nom,
    lobbyiste.type ? (TYPES[lobbyiste.type] ?? lobbyiste.type) : null,
    lobbyiste.secteur ? `Secteur : ${lobbyiste.secteur}` : null,
    nbActions > 0 ? `${nbActions} action${nbActions > 1 ? "s" : ""} de lobbying` : null,
    "Données HATVP sur CLAIR.vote.",
  ]
    .filter(Boolean)
    .join(". ");
  const url = `/lobbying/${lobbyiste.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
};

const Page = async ({ params, searchParams }: Props) => {
  const { id } = await params;
  const lobbyiste = await loadLobbyiste(id);
  if (!lobbyiste) notFound();
  return (
    <>
      <JsonLd
        data={[
          lobbyisteJsonLd(SITE_URL, lobbyiste.data),
          filArianeJsonLd(SITE_URL, [
            { nom: "Lobbying", chemin: "/lobbying" },
            { nom: lobbyiste.data.nom, chemin: `/lobbying/${lobbyiste.data.id}` },
          ]),
        ]}
      />
      <LobbyisteFicheScreen id={id} params={await searchParams} initialData={lobbyiste} />
    </>
  );
};

export default Page;
