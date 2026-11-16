import { ApiError } from "@clair/api-client";
import type { SujetArticlePresse, SujetLien } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { SLUG_EXEMPLE } from "./fixtures.ts";
import { RessourcesSujet } from "./RessourcesSujet.tsx";

const presse = `/sujets/${SLUG_EXEMPLE}/presse`;

// Liens fictifs.
const liensExemple = (famille: SujetLien["famille"], n: number): SujetLien[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${famille}-${i}`,
    famille,
    titre: `Lien d'exemple ${famille} ${i + 1}`,
    url: `https://example.org/${famille}/${i}`,
    source: "exemple",
    sourceLabel: i === 0 ? null : "Exemple",
    datePublication: null,
    ordre: i,
  }));

// Articles fictifs.
const articles: SujetArticlePresse[] = [
  {
    titre: "Article d'exemple 1",
    media: "Média fictif",
    url: "https://example.org/a1",
    date: "2026-05-01T00:00:00.000Z",
  },
  {
    titre: "Article d'exemple 2",
    media: null,
    url: "https://example.org/a2",
    date: "2026-05-02T00:00:00.000Z",
  },
  {
    titre: "Article d'exemple 3",
    media: "Média fictif",
    url: "https://example.org/a3",
    date: null,
  },
  { titre: "Article d'exemple 4", media: null, url: "https://example.org/a4", date: null },
  { titre: "Article d'exemple 5", media: null, url: "https://example.org/a5", date: null },
];

describe("RessourcesSujet : états", () => {
  it("replie les documents au-delà de cinq et les déplie à la demande", async () => {
    const { getByRole, queryByRole, findByText } = renderScreen(
      <RessourcesSujet
        slug={SLUG_EXEMPLE}
        liens={{
          construction: liensExemple("construction", 7),
          contexte: liensExemple("contexte", 1),
        }}
      />,
      { routes: { [presse]: { data: [] } } },
    );
    expect(getByRole("heading", { name: "Documents officiels (7)" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Pour aller plus loin (1)" })).toBeInTheDocument();
    expect(queryByRole("link", { name: /construction 7/ })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Voir les 2 autres" }));
    expect(getByRole("link", { name: /construction 7/ })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Voir moins" }));
    expect(queryByRole("link", { name: /construction 7/ })).toBeNull();
    expect(await findByText("Aucun article récent.")).toBeInTheDocument();
  });

  it("sans liens : seule la carte presse, en chargement", () => {
    const { getByRole, queryByRole } = renderScreen(
      <RessourcesSujet slug={SLUG_EXEMPLE} liens={undefined} />,
      { routes: { [presse]: () => new Promise(() => undefined) } },
    );
    expect(queryByRole("heading", { name: /Documents officiels/ })).toBeNull();
    expect(getByRole("heading", { name: "Dans les médias" })).toBeInTheDocument();
    expect(getByRole("status")).toHaveTextContent("Chargement des articles");
  });

  it("presse en erreur : aucun article", async () => {
    const { findByText } = renderScreen(<RessourcesSujet slug={SLUG_EXEMPLE} liens={undefined} />, {
      routes: {
        [presse]: () => {
          throw new ApiError(500, presse);
        },
      },
    });
    expect(await findByText("Aucun article récent.")).toBeInTheDocument();
  });

  it("liste les articles avec média et date quand ils sont connus", async () => {
    const { findByRole, getByRole, getByText } = renderScreen(
      <RessourcesSujet slug={SLUG_EXEMPLE} liens={undefined} />,
      { routes: { [presse]: { data: articles } } },
    );
    expect(await findByRole("link", { name: /Article d'exemple 1/ })).toBeInTheDocument();
    expect(getByText("Source : Google Actualités")).toBeInTheDocument();
    const premier = getByRole("link", { name: /Article d'exemple 1/ }).closest("li");
    expect(premier).toHaveTextContent("Média fictif ·");
    const quatrieme = getByRole("link", { name: /Article d'exemple 4/ }).closest("li");
    expect(quatrieme).not.toHaveTextContent("·");
    fireEvent.click(getByRole("button", { name: "Voir l'autre" }));
    expect(getByRole("link", { name: /Article d'exemple 5/ })).toBeInTheDocument();
  });

  it("un seul élément caché : libellé correct au singulier", async () => {
    const { findByRole } = renderScreen(<RessourcesSujet slug={SLUG_EXEMPLE} liens={undefined} />, {
      routes: { [presse]: { data: articles } },
    });
    expect(await findByRole("button", { name: "Voir l'autre" })).toBeInTheDocument();
  });
});
