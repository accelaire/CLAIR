import { ApiError } from "@clair/api-client";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { apercuExemple, listeSortants } from "./fixtures.ts";
import { GraphiqueScreen } from "./GraphiqueScreen.tsx";
import type { SlugGraphique } from "./lib/graphiques.ts";

/* Données FICTIVES de la rubrique. */
const initialData = { apercu: apercuExemple, sortants: listeSortants() };

describe("GraphiqueScreen, états", () => {
  it("chargement des sortants", () => {
    const { getByText } = renderScreen(<GraphiqueScreen slug="carte" />, {
      routes: {
        "/senatoriales/2026": apercuExemple,
        "/senatoriales/2026/sortants": () => new Promise(() => undefined),
      },
    });
    expect(getByText("Chargement du graphique…")).toBeInTheDocument();
  });

  it("erreur : données indisponibles, avec bouton pour réessayer", async () => {
    const { findByRole, getByText } = renderScreen(<GraphiqueScreen slug="carte" />, {
      routes: {
        "/senatoriales/2026": apercuExemple,
        "/senatoriales/2026/sortants": () => {
          throw new ApiError(500, "/senatoriales/2026/sortants");
        },
      },
    });
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    expect(getByText("Les données ne sont pas disponibles pour le moment.")).toBeInTheDocument();
  });

  it("aucun sortant : données indisponibles", () => {
    const { getByText } = renderScreen(
      <GraphiqueScreen
        slug="commissions"
        initialData={{ apercu: apercuExemple, sortants: listeSortants([]) }}
      />,
    );
    expect(getByText("Les données ne sont pas disponibles pour le moment.")).toBeInTheDocument();
  });

  it.each<[SlugGraphique, string]>([
    ["carte", "Sièges renouvelés par département"],
    ["commissions", "Sortants par commission permanente"],
    ["professions", "Sortants par famille professionnelle"],
  ])("« %s » : tableau « %s »", (slug, legende) => {
    const { getByRole } = renderScreen(<GraphiqueScreen slug={slug} initialData={initialData} />);
    expect(getByRole("table", { name: legende })).toBeInTheDocument();
  });

  it("présence : deux sections, présence et loyauté", () => {
    const { getByRole } = renderScreen(
      <GraphiqueScreen slug="presence" initialData={initialData} />,
    );
    expect(getByRole("heading", { level: 2, name: "Présence aux votes solennels" })).toBeVisible();
    expect(getByRole("heading", { level: 2, name: "Loyauté au groupe" })).toBeVisible();
  });

  it.each<SlugGraphique>(["groupes", "activite"])("« %s » : titre de page", (slug) => {
    const { getByRole } = renderScreen(<GraphiqueScreen slug={slug} initialData={initialData} />);
    expect(getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("groupes sans aperçu chargé : rien sous le titre", () => {
    const { getByRole, queryByRole } = renderScreen(
      <GraphiqueScreen slug="groupes" initialData={{ sortants: listeSortants() }} />,
      { routes: { "/senatoriales/2026": () => new Promise(() => undefined) } },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Ce que chaque groupe remet en jeu",
    );
    expect(queryByRole("table")).toBeNull();
  });
});
