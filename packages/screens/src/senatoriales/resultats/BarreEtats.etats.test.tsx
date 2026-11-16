import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { BarreEtats, type EtatBarre } from "./BarreEtats.tsx";

/* Circonscriptions FICTIVES (le code « 999 » n'a pas de page). */
const etats: EtatBarre[] = [
  { statut: "pourvue", libelle: "Pourvues", nombre: 2 },
  { statut: "resultats_attendus", libelle: "Résultats attendus", nombre: 1 },
];
const circonscriptions = [
  { departement: "33", nom: "Gironde", statut: "pourvue" as const },
  { departement: "01", nom: "Ain", statut: "pourvue" as const },
  { departement: "999", nom: "Circonscription fictive", statut: "resultats_attendus" as const },
];

const rendu = () =>
  renderScreen(<BarreEtats etats={etats} total={3} circonscriptions={circonscriptions} />);

describe("BarreEtats", () => {
  it("invite à choisir un état tant qu'aucun n'est ouvert", () => {
    const { getByText, getByRole } = rendu();
    expect(getByText(/Survolez ou touchez un état/)).toBeInTheDocument();
    expect(getByRole("button", { name: "Pourvues 2" })).toHaveAttribute("aria-expanded", "false");
  });

  it("au clic, épingle un état et liste ses circonscriptions par ordre alphabétique", () => {
    const { getByRole, getAllByRole, getByText, queryByText } = rendu();
    fireEvent.click(getByRole("button", { name: "Pourvues 2" }));
    expect(getByRole("button", { name: "Pourvues 2" })).toHaveAttribute("aria-expanded", "true");
    expect(getByText("Pourvues : 2")).toBeInTheDocument();
    const liens = getAllByRole("link");
    expect(liens.map((l) => l.textContent)).toEqual(["Ain", "Gironde"]);
    expect(liens[0]).toHaveAttribute("href", "/senatoriales-2026/ain");
    // Un second clic referme le détail.
    fireEvent.click(getByRole("button", { name: "Pourvues 2" }));
    expect(queryByText("Pourvues : 2")).toBeNull();
  });

  it("une circonscription sans page s'affiche sans lien", () => {
    const { getByRole, getByText, queryByRole } = rendu();
    fireEvent.click(getByRole("button", { name: "Résultats attendus 1" }));
    expect(getByText("Circonscription fictive")).toBeInTheDocument();
    expect(queryByRole("link")).toBeNull();
  });

  it("le survol à la souris montre le détail, la sortie le retire ; le toucher ne fait rien", () => {
    const { getByRole, getByText, queryByText, container } = rendu();
    const bouton = getByRole("button", { name: "Pourvues 2" });
    fireEvent.pointerOver(bouton, { pointerType: "touch" });
    expect(queryByText("Pourvues : 2")).toBeNull();
    fireEvent.pointerOver(bouton, { pointerType: "mouse" });
    expect(getByText("Pourvues : 2")).toBeInTheDocument();
    const racine = container.querySelector("#detail-etats")?.parentElement;
    if (!racine) throw new Error("barre introuvable");
    fireEvent.pointerOut(racine, { pointerType: "touch" });
    expect(getByText("Pourvues : 2")).toBeInTheDocument();
    fireEvent.pointerOut(racine, { pointerType: "mouse" });
    expect(queryByText("Pourvues : 2")).toBeNull();
  });

  it("un clic sur un segment de la barre bascule aussi l'état", () => {
    const { getByText, getAllByRole } = rendu();
    const segments = getAllByRole("button", { hidden: true }).filter(
      (b) => b.getAttribute("aria-hidden") === "true",
    );
    const segment = segments[1];
    if (!segment) throw new Error("segment introuvable");
    fireEvent.pointerOver(segment, { pointerType: "mouse" });
    fireEvent.click(segment);
    expect(getByText("Résultats attendus : 1")).toBeInTheDocument();
  });
});
