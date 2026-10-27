import { fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import {
  groupeExemple,
  groupeExempleBis,
  groupeExempleSenat,
  groupesExemple,
  legislaturesExemple,
  sessionsExemple,
} from "./fixtures.ts";
import { GroupesListeScreen } from "./GroupesListeScreen.tsx";

const routes = (groupes = groupesExemple()) => ({
  "/parlementaires/groupes": groupes,
  "/deputes/groupes": groupesExemple([groupeExemple, groupeExempleBis]),
  "/senateurs/groupes": groupesExemple([groupeExempleSenat]),
  "/deputes/legislatures": legislaturesExemple,
  "/scrutins/periodes": sessionsExemple,
});

describe("GroupesListeScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<GroupesListeScreen />, {
      routes: { "/parlementaires/groupes": () => new Promise(() => {}) },
      pathname: "/groupes",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des groupes");
  });

  it("présente les groupes par chambre, avec un lien vers chaque fiche", async () => {
    const { findByRole, getByRole } = renderScreen(<GroupesListeScreen />, {
      routes: routes(),
      pathname: "/groupes",
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Groupes parlementaires");
    expect(
      await findByRole("heading", { level: 2, name: "Assemblée nationale" }),
    ).toBeInTheDocument();
    expect(getByRole("heading", { level: 2, name: "Sénat" })).toBeInTheDocument();
    const cartes = within(getByRole("list", { name: "Groupes, Assemblée nationale" }));
    expect(cartes.getByRole("link", { name: /Groupe bis des jardiniers/ })).toHaveAttribute(
      "href",
      "/groupes/assemblee/gbis",
    );
    expect(getByRole("link", { name: /Voir tous les sénateurs/ })).toHaveAttribute(
      "href",
      "/senateurs",
    );
  });

  it("reprend les données du serveur sans attendre", () => {
    const { getByRole } = renderScreen(<GroupesListeScreen initialData={groupesExemple()} />, {
      routes: routes(),
      pathname: "/groupes",
    });
    const cartes = within(getByRole("list", { name: "Groupes, Assemblée nationale" }));
    expect(cartes.getByRole("link", { name: /Groupe d'exemple/ })).toBeInTheDocument();
  });

  it("filtre par recherche, sans tenir compte des accents", async () => {
    const { findByRole, queryByRole } = renderScreen(
      <GroupesListeScreen params={{ search: "senatorial" }} />,
      { routes: routes(), pathname: "/groupes" },
    );
    const liste = await findByRole("list", { name: "Groupes, Sénat" });
    expect(within(liste).getByRole("link", { name: /Groupe sénatorial/ })).toBeInTheDocument();
    expect(queryByRole("heading", { level: 2, name: "Assemblée nationale" })).toBeNull();
  });

  it("garde la chambre, la législature et la recherche dans l'URL", async () => {
    const { findByLabelText, getByRole, visited } = renderScreen(
      <GroupesListeScreen params={{ chambre: "assemblee" }} />,
      { routes: routes(), pathname: "/groupes" },
    );
    fireEvent.change(await findByLabelText("Législature"), { target: { value: "16" } });
    expect(visited).toEqual(["/groupes?chambre=assemblee&legislature=16"]);
    fireEvent.change(getByRole("searchbox", { name: "Rechercher un groupe" }), {
      target: { value: "bis" },
    });
    await waitFor(() => expect(visited[1]).toBe("/groupes?search=bis&chambre=assemblee"));
  });

  it("affiche un état vide et propose d'effacer la recherche", async () => {
    const { findByText, getByRole, visited } = renderScreen(
      <GroupesListeScreen params={{ search: "introuvable" }} />,
      { routes: routes(), pathname: "/groupes" },
    );
    expect(await findByText("Aucun groupe trouvé")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Voir tous les groupes" }));
    expect(visited).toEqual(["/groupes"]);
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<GroupesListeScreen />, {
      routes: { "/parlementaires/groupes": () => Promise.reject(new Error("panne")) },
      pathname: "/groupes",
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
