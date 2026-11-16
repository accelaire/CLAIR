import type { ResumeCirconscription } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { resultatsNationauxExemple } from "../fixtures.ts";
import { GrilleCirconscriptions } from "./GrilleCirconscriptions.tsx";

/* Circonscriptions FICTIVES dérivées des fixtures ; le code « 999 » n'a pas de page. */
const [ain, gironde] = resultatsNationauxExemple.circonscriptions;
if (!ain || !gironde) throw new Error("fixtures incomplètes");
const circonscriptions: ResumeCirconscription[] = [
  gironde,
  ain,
  {
    ...ain,
    departement: "999",
    nom: "Circonscription fictive",
    nbSieges: 3,
    statut: "pas_ouvert",
    sieges: [null, null, null],
  },
  { ...ain, departement: "02", nom: "Aisne", statut: "pourvue", nbSieges: 3 },
];

const noms = (liste: HTMLElement) =>
  within(liste)
    .getAllByRole("listitem")
    .map((li) => li.textContent?.split(/(Résultats|Vote)/)[0]);

const rendu = () =>
  renderScreen(
    <GrilleCirconscriptions circonscriptions={circonscriptions} base="/senatoriales-2026" />,
  );

const vignettes = (container: HTMLElement) => {
  const listes = within(container).getAllByRole("list");
  const derniere = listes[listes.length - 1];
  if (!derniere) throw new Error("grille introuvable");
  return derniere;
};

describe("GrilleCirconscriptions", () => {
  it("par défaut : toutes, par ordre alphabétique, sans lien pour une circonscription inconnue", () => {
    const { container, getByRole } = rendu();
    expect(getByRole("button", { name: "Toutes · 4" })).toHaveAttribute("aria-pressed", "true");
    expect(noms(vignettes(container))).toEqual([
      "Ain",
      "Aisne",
      "Circonscription fictive",
      "Gironde",
    ]);
    expect(getByRole("link", { name: /^Gironde/ })).toHaveAttribute(
      "href",
      "/senatoriales-2026/gironde",
    );
    expect(within(vignettes(container)).getAllByRole("link")).toHaveLength(3);
  });

  it("filtre les pourvues, puis celles en attente", () => {
    const { container, getByRole } = rendu();
    fireEvent.click(getByRole("button", { name: "Pourvues · 2" }));
    expect(noms(vignettes(container))).toEqual(["Ain", "Aisne"]);
    fireEvent.click(getByRole("button", { name: "En attente · 2" }));
    expect(noms(vignettes(container))).toEqual(["Circonscription fictive", "Gironde"]);
  });

  it("trie par état, puis par nombre de sièges", () => {
    const { container, getByRole } = rendu();
    const tri = getByRole("combobox", { name: "Trier" });
    fireEvent.change(tri, { target: { value: "etat" } });
    expect(noms(vignettes(container))).toEqual([
      "Ain",
      "Aisne",
      "Gironde",
      "Circonscription fictive",
    ]);
    fireEvent.change(tri, { target: { value: "sieges" } });
    expect(noms(vignettes(container))).toEqual([
      "Gironde",
      "Aisne",
      "Circonscription fictive",
      "Ain",
    ]);
  });
});
