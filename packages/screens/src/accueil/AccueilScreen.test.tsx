import { ApiError } from "@clair/api-client";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { AccueilScreen } from "./AccueilScreen.tsx";
import { homepageExemple } from "./fixtures.ts";

describe("AccueilScreen", () => {
  it("affiche l'accroche et le contenu éditorial sans attendre l'API", () => {
    const { getByRole, getAllByRole } = renderScreen(<AccueilScreen />, {
      routes: { "/homepage": () => new Promise(() => undefined) },
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "La politique française, en clair",
    );
    expect(getByRole("status")).toHaveTextContent("Chargement de l'agenda");
    expect(getByRole("heading", { name: "Questions fréquentes" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Quel est l'objectif de CLAIR ?" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(getByRole("link", { name: "En savoir plus : Le lobbying" })).toHaveAttribute(
      "href",
      "/comprendre/lobbying",
    );
    expect(getAllByRole("link", { name: /Faire un don/ })[0]).toHaveAttribute("href", "/soutenir");
  });

  it("affiche les chiffres clés, leur provenance et la date de mise à jour", () => {
    const { getByRole, getByText } = renderScreen(<AccueilScreen initialData={homepageExemple} />, {
      routes: {},
    });
    const chiffres = getByRole("list", { name: "Chiffres clés" });
    const deputes = within(chiffres).getByRole("link", { name: /Députés/ });
    expect(deputes).toHaveAttribute("href", "/deputes");
    expect(deputes).toHaveTextContent("577");
    expect(deputes).toHaveTextContent("1 200 au total");
    expect(within(chiffres).getByRole("link", { name: /Interventions/ })).toHaveTextContent(
      "1 234 567",
    );
    expect(getByText("Calculée par CLAIR")).toBeInTheDocument();
    expect(getByText(/Données mises à jour le/)).toHaveTextContent("2 mars 2026 à 06:12");
  });

  it("présente l'agenda des prochains jours et les échéances", () => {
    const { getByRole } = renderScreen(<AccueilScreen initialData={homepageExemple} />, {
      routes: {},
    });
    const jours = getByRole("region", { name: "Jours à venir" });
    expect(within(jours).getByRole("heading", { name: "Mardi 3 mars" })).toBeInTheDocument();
    expect(within(jours).getByRole("heading", { name: "Mercredi 4 mars" })).toBeInTheDocument();
    expect(within(jours).getByRole("link", { name: /Afficher plus \(1\)/ })).toHaveAttribute(
      "href",
      "/agenda?date=2026-03-03",
    );
    const seance = within(jours).getAllByRole("link", { name: /Séance publique/ })[0];
    expect(seance).toHaveAttribute("href", "/reunions/RUANR5L17S2026IDS00001");
    expect(seance).toHaveTextContent("15:00");
    expect(getByRole("heading", { name: "Prochaines échéances" })).toBeInTheDocument();
    expect(getByRole("link", { name: /Exemple : élection fictive/ })).toHaveAttribute(
      "href",
      "/agenda?date=2026-04-12",
    );
    expect(
      getByRole("link", { name: "Voir l'agenda complet : Prochainement au Parlement" }),
    ).toHaveAttribute("href", "/agenda");
  });

  it("liste les derniers dossiers discutés, état en texte", () => {
    const { getByRole } = renderScreen(<AccueilScreen initialData={homepageExemple} />, {
      routes: {},
    });
    const lien = getByRole("link", { name: "Exemple : réforme des jardins partagés" });
    expect(lien).toHaveAttribute("href", "/dossiers/DLR5L17N00001");
    expect(lien.closest("li")).toHaveTextContent("En cours");
  });

  it("annonce un agenda vide", async () => {
    const { findByText, queryByRole } = renderScreen(<AccueilScreen />, {
      routes: {
        "/homepage": {
          ...homepageExemple,
          trendingDossiers: [],
          upcoming: { events: [], evenements: [], echeances: [] },
        },
      },
    });
    expect(await findByText("Aucun événement à venir")).toBeInTheDocument();
    expect(queryByRole("heading", { name: "Derniers dossiers législatifs discutés" })).toBeNull();
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<AccueilScreen />, {
      routes: {
        "/homepage": () => {
          throw new ApiError(500, "/homepage");
        },
      },
    });
    expect(await findByRole("alert")).toHaveTextContent("L'agenda n'a pas pu être chargé");
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("mène la recherche vers /recherche", async () => {
    const { getByRole, visited } = renderScreen(<AccueilScreen initialData={homepageExemple} />, {
      routes: {},
    });
    const champ = getByRole("searchbox", {
      name: "Rechercher un député, un département, un scrutin",
    });
    fireEvent.change(champ, { target: { value: "  Paris " } });
    fireEvent.click(getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(visited).toContain("/recherche?q=Paris"));
  });
});
