import type { SujetEtapeParcours } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { dossiersExemple, SLUG_EXEMPLE, sujetExemple } from "./fixtures.ts";
import { ParcoursSujet } from "./ParcoursSujet.tsx";

const chronologie = `/sujets/${SLUG_EXEMPLE}/chronologie`;

// Étapes fictives : deux réunions de commission (l'une nommée), deux séances.
const etapes: SujetEtapeParcours[] = [
  {
    uid: "COM-EXEMPLE-1",
    type: "commission",
    date: "2026-02-01T09:00:00.000Z",
    chambre: null,
    commission: null,
    nbPrises: null,
    nbAvis: 3,
    scrutins: [],
  },
  {
    uid: "COM-EXEMPLE-2",
    type: "commission",
    date: "2026-02-02T09:00:00.000Z",
    chambre: "senat",
    commission: { slug: "commission-exemple", nom: "Commission d'exemple" },
    nbPrises: 1,
    nbAvis: null,
    consultable: false,
    textes: [],
    scrutins: [],
  },
  {
    uid: "SEANCE-EXEMPLE-1",
    type: "seance",
    date: "2026-03-01T14:00:00.000Z",
    chambre: "assemblee",
    commission: null,
    nbPrises: 12,
    nbAvis: null,
    consultable: true,
    textes: [{ uid: "DLR5L17N00001", titre: "Texte d'exemple" }],
    scrutins: [
      {
        id: "vote-exemple-1",
        numero: 7,
        titre: "Exemple : l'article premier",
        date: "2026-03-01T15:00:00.000Z",
        sort: "adopte",
        chambre: "assemblee",
        session: "2025",
        nombrePour: 30,
        nombreContre: 10,
        nombreAbstention: 2,
      },
    ],
  },
  {
    uid: "SEANCE-EXEMPLE-2",
    type: "seance",
    date: "2026-03-02T14:00:00.000Z",
    chambre: "assemblee",
    commission: null,
    nbPrises: null,
    nbAvis: null,
    scrutins: [],
  },
];

describe("ParcoursSujet : états", () => {
  it("n'affiche rien sans dossier", () => {
    const { queryByRole } = renderScreen(
      <ParcoursSujet slug={SLUG_EXEMPLE} sujet={sujetExemple} dossiers={[]} />,
      { routes: { [chronologie]: { data: etapes } } },
    );
    expect(queryByRole("list")).toBeNull();
    expect(queryByRole("button")).toBeNull();
  });

  it("résume séances et réunions, puis les déplie", async () => {
    const { findByRole, getByRole, getByText, queryByRole } = renderScreen(
      <ParcoursSujet slug={SLUG_EXEMPLE} sujet={sujetExemple} dossiers={dossiersExemple.data} />,
      { routes: { [chronologie]: { data: etapes } } },
    );
    const bouton = await findByRole("button", { name: /Séances et réunions/ });
    expect(bouton).toHaveTextContent("2 séances publiques · 2 réunions de commission");
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(getByText("Réunion de commission")).toBeInTheDocument();
    expect(getByText("Commission d'exemple")).toBeInTheDocument();
    expect(queryByRole("link", { name: "Commission d'exemple" })).toBeNull();
    expect(getByText("3 avis")).toBeInTheDocument();
    expect(getByText("1 prise de parole")).toBeInTheDocument();
    expect(getByRole("link", { name: "Séance publique" })).toHaveAttribute(
      "href",
      "/reunions/SEANCE-EXEMPLE-1",
    );
    expect(getByText("Texte d'exemple")).toBeInTheDocument();
  });

  it("une seule séance, sans réunion de commission", async () => {
    const { findByRole } = renderScreen(
      <ParcoursSujet slug={SLUG_EXEMPLE} sujet={sujetExemple} dossiers={dossiersExemple.data} />,
      { routes: { [chronologie]: { data: etapes.slice(3) } } },
    );
    const bouton = await findByRole("button", { name: /Séances et réunions/ });
    expect(bouton).toHaveTextContent(/1 séance publique$/);
  });

  it("des réunions de commission seules", async () => {
    const { findByRole } = renderScreen(
      <ParcoursSujet slug={SLUG_EXEMPLE} sujet={sujetExemple} dossiers={dossiersExemple.data} />,
      { routes: { [chronologie]: { data: etapes.slice(0, 1) } } },
    );
    const bouton = await findByRole("button", { name: /Séances et réunions/ });
    expect(bouton).toHaveTextContent(/1 réunion de commission$/);
  });
});
