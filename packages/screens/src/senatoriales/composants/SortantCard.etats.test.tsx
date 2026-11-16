import type { CandidatureSortant, Sortant } from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { sortantsExemple } from "../fixtures.ts";
import { SortantCard } from "./SortantCard.tsx";

// Variantes fictives dérivées des fixtures.
const homme = sortantsExemple[0] as Sortant;
const femme = sortantsExemple[1] as Sortant;
const candidat = sortantsExemple[2] as Sortant;
const candidature = candidat.candidature as CandidatureSortant;
const avecCandidature = (extra: Partial<CandidatureSortant>): Sortant => ({
  ...candidat,
  candidature: { ...candidature, ...extra },
});

describe("SortantCard", () => {
  it("affiche identité, groupe, circonscription, commission et bilan", () => {
    renderScreen(<SortantCard sortant={homme} />);
    expect(screen.getByRole("link", { name: /Hervé Exemple/ })).toHaveAttribute(
      "href",
      "/senateurs/hervé-exemple",
    );
    expect(screen.getByText("Groupe Exemple A")).toBeInTheDocument();
    expect(screen.getByText("Ain")).toBeInTheDocument();
    expect(screen.getByText("Commission fictive des exemples")).toBeInTheDocument();
    expect(screen.getByText("97 %")).toBeInTheDocument();
    expect(screen.queryByText("Se représente")).not.toBeInTheDocument();
    expect(screen.queryByText("Ne se représente pas")).not.toBeInTheDocument();
  });

  it("affiche « — » pour une statistique absente, sans groupe ni circonscription", () => {
    const vide: Sortant = {
      ...femme,
      circonscription: null,
      commissionPermanente: null,
      bilan: { ...femme.bilan, interventions: null, amendements: null },
    };
    renderScreen(<SortantCard sortant={vide} surbrillance />);
    expect(screen.getByText("Sans groupe")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByText("(surligné)")).toBeInTheDocument();
    expect(screen.getByText(/En fonction depuis/)).toHaveTextContent("février 2024");
    expect(screen.getByText("Mandat interrompu")).toBeInTheDocument();
  });

  it("dit qui ne se représente pas une fois les candidatures publiées", () => {
    renderScreen(<SortantCard sortant={homme} candidaturesPubliees />);
    expect(screen.getByText("Ne se représente pas")).toBeInTheDocument();
  });

  it("détaille la candidature au proportionnel, tête de liste", () => {
    renderScreen(<SortantCard sortant={candidat} candidaturesPubliees />);
    expect(screen.getByText("Se représente")).toHaveAttribute(
      "title",
      "Liste « Liste Exemple pour la Gironde » — 1re position",
    );
  });

  it("détaille la candidature en remplaçant, plus bas sur la liste", () => {
    renderScreen(
      <SortantCard
        sortant={avecCandidature({ ordre: 3, role: "suppleant" })}
        candidaturesPubliees
      />,
    );
    expect(screen.getByText("Se représente")).toHaveAttribute(
      "title",
      "Liste « Liste Exemple pour la Gironde » — 3e position — en remplaçant",
    );
  });

  it("se contente d'une mention générale au majoritaire sans libellé", () => {
    renderScreen(
      <SortantCard
        sortant={avecCandidature({ libelle: null, modeScrutin: "majoritaire" })}
        candidaturesPubliees
      />,
    );
    expect(screen.getByText("Se représente")).toHaveAttribute(
      "title",
      "Candidat au renouvellement du 27 septembre",
    );
  });

  it("donne l'issue du scrutin, accordée", () => {
    const { unmount } = renderScreen(
      <SortantCard sortant={homme} sort="reelu" candidaturesPubliees />,
    );
    expect(screen.getByText("Réélu le 27 septembre")).toBeInTheDocument();
    expect(screen.queryByText("Ne se représente pas")).not.toBeInTheDocument();
    unmount();
    renderScreen(<SortantCard sortant={femme} sort="reelu" />);
    expect(screen.getByText("Réélue le 27 septembre")).toBeInTheDocument();
  });

  it("dit battu ou battue, et qui ne se représentait pas", () => {
    const { unmount } = renderScreen(<SortantCard sortant={homme} sort="battu" />);
    expect(screen.getByText("Battu")).toBeInTheDocument();
    unmount();
    const r = renderScreen(<SortantCard sortant={femme} sort="battu" />);
    expect(screen.getByText("Battue")).toBeInTheDocument();
    r.unmount();
    renderScreen(<SortantCard sortant={homme} sort="ne_se_representait_pas" />);
    expect(screen.getByText("Ne se représentait pas")).toBeInTheDocument();
  });

  it("revient à la candidature tant que le sort est en attente", () => {
    renderScreen(<SortantCard sortant={candidat} sort="en_attente" candidaturesPubliees />);
    expect(screen.getByText("Se représente")).toBeInTheDocument();
  });
});
