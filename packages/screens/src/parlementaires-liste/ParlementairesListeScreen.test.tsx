import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { groupesExemple, legislaturesExemple, listeExemple, pageListe } from "./fixtures.ts";
import { ParlementairesListeScreen } from "./ParlementairesListeScreen.tsx";

const routes = {
  "/deputes": listeExemple,
  "/deputes/groupes": groupesExemple,
  "/deputes/legislatures": legislaturesExemple,
};

describe("ParlementairesListeScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<ParlementairesListeScreen chambre="assemblee" />, {
      pathname: "/deputes",
      routes: { ...routes, "/deputes": () => new Promise(() => {}) },
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Députés");
    expect(getByRole("status")).toHaveTextContent("Chargement des députés");
  });

  it("affiche les cartes, l'effectif et la pagination en liens", async () => {
    const { findByRole, getByRole, getByText } = renderScreen(
      <ParlementairesListeScreen chambre="assemblee" />,
      { pathname: "/deputes", routes },
    );
    expect(await findByRole("link", { name: /Camille Exemple/ })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
    expect(getByText(/30 députés sur 577 sièges — XVIIe législature/)).toBeInTheDocument();
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute("href", "/deputes?page=2");
  });

  it("reprend les données du serveur sans attendre l'API", () => {
    const { getByRole } = renderScreen(
      <ParlementairesListeScreen chambre="assemblee" initialData={{ liste: listeExemple }} />,
      { pathname: "/deputes", routes },
    );
    expect(getByRole("link", { name: /Dominique Test/ })).toBeInTheDocument();
  });

  it("propose d'effacer les filtres quand rien ne correspond", async () => {
    const { findByText, getByRole, visited } = renderScreen(
      <ParlementairesListeScreen chambre="assemblee" params={{ search: "zzz", page: "1" }} />,
      { pathname: "/deputes", routes: { ...routes, "/deputes": pageListe([]) } },
    );
    expect(await findByText("Aucun député trouvé")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Effacer les filtres" }));
    expect(visited).toEqual(["/deputes"]);
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<ParlementairesListeScreen chambre="senat" />, {
      pathname: "/senateurs",
      routes: {},
    });
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("écrit le groupe et le tri dans l'URL, en revenant à la première page", async () => {
    const { findByRole, getByLabelText, visited } = renderScreen(
      <ParlementairesListeScreen chambre="assemblee" params={{ page: "2" }} />,
      { pathname: "/deputes", routes },
    );
    await findByRole("option", { name: "EXE (2)" });
    fireEvent.change(getByLabelText("Groupe politique"), { target: { value: "exemple" } });
    fireEvent.change(getByLabelText("Trier par"), { target: { value: "presence" } });
    expect(visited).toEqual(["/deputes?groupe=exemple", "/deputes?tri=presence"]);
  });

  it("garde la sélection du comparateur dans l'URL", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <ParlementairesListeScreen chambre="assemblee" params={{ compare: "dominique-test" }} />,
      { pathname: "/deputes", routes },
    );
    fireEvent.click(await findByRole("checkbox", { name: /Comparer Camille Exemple/ }));
    expect(visited).toEqual(["/deputes?compare=dominique-test%2Ccamille-exemple"]);
    await waitFor(() =>
      expect(getByRole("region", { name: "Comparaison" })).toHaveTextContent("Dominique Test"),
    );
  });
});
