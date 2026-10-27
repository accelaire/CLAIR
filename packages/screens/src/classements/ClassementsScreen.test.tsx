import type { Query } from "@clair/api-client";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ClassementsScreen } from "./ClassementsScreen.tsx";
import { groupeClasse, pageClassement, parlementaireClasse } from "./fixtures.ts";

const tous = [1, 2, 3].map((id) => parlementaireClasse(id));

const routes = (items = tous) => ({
  "/parlementaires": (query: Query) =>
    query.order === "asc"
      ? pageClassement([...items].reverse())
      : pageClassement(items, { totalPages: 3 }),
  "/parlementaires/groupes": { data: [] },
  "/parlementaires/historique-carriere": { data: { present: false } },
  "/groupes": { data: [groupeClasse(1, 50), groupeClasse(2, 70)] },
});

describe("ClassementsScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<ClassementsScreen />, {
      routes: { "/parlementaires": () => new Promise(() => {}) },
      pathname: "/classements",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement du classement");
  });

  it("affiche le top, le flop et le tableau, en signalant le calcul", async () => {
    const { findByRole, getByRole, getAllByText } = renderScreen(<ClassementsScreen />, {
      routes: routes(),
      pathname: "/classements",
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Classements parlementaires");
    const tableau = await findByRole("table", { name: /Classement des parlementaires/ });
    expect(within(tableau).getByRole("link", { name: "Camille Exemple1" })).toHaveAttribute(
      "href",
      "/deputes/personne-exemple-1",
    );
    expect(getAllByText("Calculée par CLAIR").length).toBeGreaterThan(0);
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute("href", "/classements?page=2");
  });

  it("garde le tri dans l'URL et revient en page 1", async () => {
    const { findByRole, visited } = renderScreen(<ClassementsScreen params={{ page: "2" }} />, {
      routes: routes(),
      pathname: "/classements",
    });
    const tableau = await findByRole("table", { name: /Classement des parlementaires/ });
    fireEvent.click(within(tableau).getByRole("button", { name: /Loyauté/ }));
    expect(visited).toEqual(["/classements?sort=loyaute"]);
  });

  it("change de chambre en retirant le groupe choisi", async () => {
    const { findByRole, visited } = renderScreen(<ClassementsScreen params={{ groupe: "gex" }} />, {
      routes: routes(),
      pathname: "/classements",
    });
    fireEvent.click(await findByRole("radio", { name: "Sénat" }));
    expect(visited).toEqual(["/classements?chambre=senat"]);
  });

  it("indique un classement vide", async () => {
    const { findByText } = renderScreen(<ClassementsScreen params={{ groupe: "gex" }} />, {
      routes: routes([]),
      pathname: "/classements",
    });
    expect(await findByText("Aucun parlementaire ne correspond à ces filtres")).toBeInTheDocument();
  });

  it("classe les groupes selon le critère de l'URL", async () => {
    const { findByRole } = renderScreen(<ClassementsScreen params={{ tab: "groupes" }} />, {
      routes: routes(),
      pathname: "/classements",
    });
    const tableau = await findByRole("table", { name: /groupes politiques par présence/ });
    const lignes = within(tableau).getAllByRole("row");
    expect(lignes[1]).toHaveTextContent("Groupe d'exemple numéro 2");
  });

  it("retrouve la page d'un parlementaire mis en avant grâce à son rang", async () => {
    const pages: unknown[] = [];
    const { findByText } = renderScreen(
      <ClassementsScreen params={{ highlight: "personne-exemple-2" }} />,
      {
        routes: {
          ...routes(),
          "/parlementaires/personne-exemple-2/rank": { data: { rank: 120, total: 300 } },
          "/parlementaires": (query: Query) => {
            if (query.limit === 50) pages.push(query.page);
            return pageClassement(tous, { page: 3, totalPages: 6 });
          },
        },
        pathname: "/classements",
      },
    );
    expect(await findByText("Mis en avant")).toBeInTheDocument();
    expect(pages).toEqual([3]);
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<ClassementsScreen />, {
      routes: { "/parlementaires": () => Promise.reject(new Error("panne")) },
      pathname: "/classements",
    });
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
