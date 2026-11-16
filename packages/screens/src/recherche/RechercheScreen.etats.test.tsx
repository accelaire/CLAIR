import { ApiError, type Query } from "@clair/api-client";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { apercuExemple, deputeExemple, pageDeputes } from "./fixtures.ts";
import { RechercheScreen } from "./RechercheScreen.tsx";

/** Rendu où la route `/search` reste en chargement : seules les données de la route s'affichent. */
const avecDonneesDeRoute = (
  params: Record<string, string>,
  initialData: Parameters<typeof RechercheScreen>[0]["initialData"],
) =>
  renderScreen(<RechercheScreen params={params} initialData={initialData} />, {
    routes: { "/search": () => new Promise(() => undefined) },
  });

describe("RechercheScreen, données de la route", () => {
  it("écarte des données d'une autre recherche, d'un autre périmètre ou d'un autre type", () => {
    for (const [params, donnees] of [
      [{ q: "autre" }, apercuExemple()],
      [{ q: "exemple", anciens: "1" }, apercuExemple()],
      [{ q: "exemple", type: "scrutins" }, apercuExemple()],
      [{ q: "exemple", type: "deputes" }, pageDeputes([deputeExemple], { page: 2 })],
    ] as const) {
      const { getByRole, unmount } = avecDonneesDeRoute(params, donnees);
      expect(getByRole("status")).toHaveTextContent("Recherche en cours");
      unmount();
    }
  });

  it("reprend la première page d'une catégorie", () => {
    const { getByRole } = avecDonneesDeRoute(
      { q: "exemple", type: "deputes" },
      pageDeputes([deputeExemple]),
    );
    expect(getByRole("link", { name: "Camille Exemple" })).toBeInTheDocument();
  });
});

describe("RechercheScreen, cas limites", () => {
  it("annonce un seul résultat archivé", async () => {
    const apercu = apercuExemple();
    const { findByRole } = renderScreen(<RechercheScreen params={{ q: "exemple" }} />, {
      routes: { "/search": { ...apercu, meta: { ...apercu.meta, anciensDisponibles: 1 } } },
    });
    expect(
      await findByRole("button", { name: "1 résultat archivé correspond aussi" }),
    ).toBeInTheDocument();
  });

  it("propose de réessayer quand les résultats suivants ne se chargent pas", async () => {
    const { findByRole, findByText } = renderScreen(
      <RechercheScreen params={{ q: "exemple", type: "deputes" }} />,
      {
        routes: {
          "/search": (query: Query) => {
            if (query.page === 1) return pageDeputes([deputeExemple], { total: 2, hasNext: true });
            throw new ApiError(500, "/search");
          },
        },
      },
    );
    fireEvent.click(await findByRole("button", { name: "Afficher plus de résultats" }));
    expect(
      await findByText("Les résultats suivants n'ont pas pu être chargés."),
    ).toBeInTheDocument();
  });
});
