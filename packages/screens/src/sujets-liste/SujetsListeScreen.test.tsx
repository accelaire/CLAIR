import { ApiError } from "@clair/api-client";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { pageSujets, sujetEnCours, sujetRejete, sujetsExemple } from "./fixtures.ts";
import { SujetsListeScreen } from "./SujetsListeScreen.tsx";

describe("SujetsListeScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<SujetsListeScreen />, {
      routes: { "/sujets": () => new Promise(() => undefined) },
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des sujets");
  });

  it("répartit les sujets en sections, statut en texte", async () => {
    const { findByRole, getByRole } = renderScreen(<SujetsListeScreen />, {
      routes: { "/sujets": pageSujets(sujetsExemple) },
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Sujets parlementaires");
    expect(await findByRole("button", { name: /En cours de discussion/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(getByRole("button", { name: /Promulgués/ })).toHaveAttribute("aria-expanded", "false");
    expect(getByRole("link", { name: "Exemple : réforme des jardins partagés" })).toHaveAttribute(
      "href",
      "/sujets/exemple-reforme-des-jardins-partages",
    );
    expect(
      getByRole("link", { name: "Exemple : réforme des jardins partagés" }).closest("li"),
    ).toHaveTextContent("En cours");
  });

  it("rassemble toutes les pages de l'API", async () => {
    const { findByRole } = renderScreen(<SujetsListeScreen />, {
      routes: {
        "/sujets": (query: Record<string, unknown>) =>
          query.page === 1
            ? { ...pageSujets([sujetEnCours]), meta: { ...pageSujets([]).meta, hasNext: true } }
            : pageSujets([sujetRejete]),
      },
    });
    expect(await findByRole("button", { name: /Rejetés/ })).toBeInTheDocument();
    expect(await findByRole("button", { name: /En cours de discussion/ })).toBeInTheDocument();
  });

  it("affiche l'état vide", async () => {
    const { findByText } = renderScreen(<SujetsListeScreen params={{ search: "zzz" }} />, {
      routes: { "/sujets": pageSujets([]) },
    });
    expect(await findByText("Aucun sujet trouvé")).toBeInTheDocument();
    expect(await findByText("Essayez de modifier votre recherche.")).toBeInTheDocument();
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<SujetsListeScreen />, {
      routes: {
        "/sujets": () => {
          throw new ApiError(500, "/sujets");
        },
      },
    });
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("écrit la recherche dans l'URL", async () => {
    const { getByRole, visited } = renderScreen(<SujetsListeScreen />, {
      pathname: "/sujets",
      routes: { "/sujets": pageSujets(sujetsExemple) },
    });
    const champ = getByRole("searchbox", { name: "Rechercher un sujet" });
    fireEvent.change(champ, { target: { value: "jardins" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    await waitFor(() => expect(visited).toContain("/sujets?search=jardins"));
  });

  it("reprend les données de la route sans nouvel appel", () => {
    const { getByRole } = renderScreen(
      <SujetsListeScreen initialData={[pageSujets(sujetsExemple)]} />,
      { routes: {} },
    );
    expect(getByRole("link", { name: "Exemple : horaires des bibliothèques" })).toBeInTheDocument();
  });
});
