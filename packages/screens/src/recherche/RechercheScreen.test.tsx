import { ApiError, type Query } from "@clair/api-client";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import {
  ancienneDeputee,
  apercuExemple,
  apercuVide,
  commissionDissoute,
  deputeExemple,
  pageDeputes,
} from "./fixtures.ts";
import { RechercheScreen } from "./RechercheScreen.tsx";

describe("RechercheScreen", () => {
  it("invite à saisir une recherche", () => {
    const { getByRole, getByText, queryByRole } = renderScreen(<RechercheScreen />, {
      routes: {},
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Recherche");
    expect(getByText("Commencez à taper pour rechercher")).toBeInTheDocument();
    expect(queryByRole("switch")).toBeNull();
  });

  it("exige deux caractères", () => {
    const { getByText } = renderScreen(<RechercheScreen params={{ q: "a" }} />, { routes: {} });
    expect(getByText("Minimum 2 caractères requis")).toBeInTheDocument();
  });

  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<RechercheScreen params={{ q: "exemple" }} />, {
      routes: { "/search": () => new Promise(() => undefined) },
    });
    expect(getByRole("status")).toHaveTextContent("Recherche en cours");
  });

  it("présente un aperçu par catégorie, avec les comptes", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <RechercheScreen params={{ q: "exemple" }} />,
      { pathname: "/recherche", routes: { "/search": apercuExemple() } },
    );
    const deputes = await findByRole("region", { name: /Députés/ });
    expect(within(deputes).getByRole("heading", { level: 2 })).toHaveTextContent("Députés(12)");
    const fiche = within(deputes).getByRole("link", { name: "Camille Exemple" });
    expect(fiche).toHaveAttribute("href", "/deputes/camille-exemple");
    expect(fiche.closest("li")).toHaveTextContent("EX");
    const scrutin = getByRole("link", { name: /jardins partagés/ });
    expect(scrutin).toHaveAttribute("href", "/scrutins/42?chambre=senat&session=2025");
    expect(scrutin.closest("li")).toHaveTextContent("Adopté");
    expect(getByRole("button", { name: /Tout \(13\)/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      within(deputes).getByRole("button", { name: "Voir les 12 résultats : Députés" }),
    );
    expect(visited).toContain("/recherche?q=exemple&type=deputes");
  });

  it("propose les résultats archivés et les inclut dans l'URL", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <RechercheScreen params={{ q: "exemple" }} />,
      { pathname: "/recherche", routes: { "/search": apercuExemple() } },
    );
    fireEvent.click(
      await findByRole("button", { name: "3 résultats archivés correspondent aussi" }),
    );
    expect(visited).toContain("/recherche?q=exemple&anciens=1");
    fireEvent.click(
      getByRole("switch", { name: "Inclure les anciens parlementaires et commissions" }),
    );
    expect(visited.filter((href) => href === "/recherche?q=exemple&anciens=1")).toHaveLength(2);
  });

  it("signale un mandat clos et une commission dissoute en texte", async () => {
    const { findByRole, getByRole } = renderScreen(
      <RechercheScreen params={{ q: "exemple", type: "deputes", anciens: "1" }} />,
      {
        routes: {
          "/search": pageDeputes([ancienneDeputee, commissionDissoute], { inclureAnciens: true }),
        },
      },
    );
    expect(
      (await findByRole("link", { name: "Dominique Exemple" })).closest("li"),
    ).toHaveTextContent("Ancienne députée · XVIe législature");
    expect(
      getByRole("link", { name: "Commission d'enquête exemple" }).closest("li"),
    ).toHaveTextContent("Dissoute");
  });

  it("charge les résultats suivants d'une catégorie à la demande", async () => {
    const { findByRole, findByText } = renderScreen(
      <RechercheScreen params={{ q: "exemple", type: "deputes" }} />,
      {
        routes: {
          "/search": (query: Query) =>
            query.page === 1
              ? pageDeputes([deputeExemple], { total: 2, hasNext: true })
              : pageDeputes([ancienneDeputee], { page: 2, total: 2 }),
        },
      },
    );
    expect(await findByText("1 résultat affiché sur 2")).toBeInTheDocument();
    fireEvent.click(await findByRole("button", { name: "Afficher plus de résultats" }));
    expect(await findByRole("link", { name: "Dominique Exemple" })).toBeInTheDocument();
    expect(await findByText("Tous les résultats ont été chargés")).toBeInTheDocument();
    expect(await findByText("2 résultats affichés sur 2")).toBeInTheDocument();
  });

  it("annonce l'absence de résultat", async () => {
    const { findByText } = renderScreen(<RechercheScreen params={{ q: "zzz" }} />, {
      routes: { "/search": apercuVide() },
    });
    expect(await findByText("Aucun résultat trouvé")).toBeInTheDocument();
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<RechercheScreen params={{ q: "exemple" }} />, {
      routes: {
        "/search": () => {
          throw new ApiError(500, "/search");
        },
      },
    });
    expect(await findByRole("alert")).toHaveTextContent("Une erreur est survenue");
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("écrit le terme dans l'URL et reprend les données de la route", async () => {
    const { getByRole, visited } = renderScreen(
      <RechercheScreen params={{ q: "exemple" }} initialData={apercuExemple()} />,
      { pathname: "/recherche", routes: {} },
    );
    expect(getByRole("link", { name: "Camille Exemple" })).toBeInTheDocument();
    const champ = getByRole("searchbox", { name: "Rechercher sur CLAIR" });
    fireEvent.change(champ, { target: { value: "jardins" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    await waitFor(() => expect(visited).toContain("/recherche?q=jardins"));
  });
});
