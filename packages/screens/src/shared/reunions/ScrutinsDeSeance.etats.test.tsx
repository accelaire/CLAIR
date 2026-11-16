import type { ScrutinDeReunion } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { grouperParDossier, ScrutinsDeSeance } from "./ScrutinsDeSeance.tsx";

// Scrutins fictifs.
const dossier = {
  id: "d1",
  uid: "DLR-EXEMPLE",
  titre: "Projet de loi fictif",
  titreCourt: null,
  procedureLibelle: null,
};
const scrutin = (numero: number, partiel: Partial<ScrutinDeReunion> = {}): ScrutinDeReunion => ({
  id: `s${numero}`,
  numero,
  titre: `l'amendement fictif ${numero}`,
  sort: "adopté",
  chambre: "assemblee",
  session: "17",
  nombrePour: 1200,
  nombreContre: 3,
  nombreAbstention: 0,
  dossier,
  ...partiel,
});

describe("grouperParDossier", () => {
  it("range les scrutins par texte, hors dossier à part", () => {
    const groupes = grouperParDossier([scrutin(1), scrutin(2, { dossier: null }), scrutin(3)]);
    expect(groupes.map((g) => [g.cle, g.scrutins.length])).toEqual([
      ["DLR-EXEMPLE", 2],
      ["sans-dossier", 1],
    ]);
  });
});

describe("ScrutinsDeSeance", () => {
  it("titre le bloc, lie le dossier et replie au-delà de trois scrutins", () => {
    renderScreen(
      <ScrutinsDeSeance scrutins={[1, 2, 3, 4, 5].map((n) => scrutin(n))} titleAs="h3" />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Scrutins de la séance (5)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Projet de loi fictif/ })).toHaveAttribute(
      "href",
      "/dossiers/DLR-EXEMPLE",
    );
    expect(screen.getAllByRole("link", { name: /Scrutin n°/ })).toHaveLength(3);
    expect(screen.getAllByText(/1\s200 pour, 3 contre/u)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Voir les 2 autres scrutins" }));
    expect(screen.getAllByRole("link", { name: /Scrutin n°/ })).toHaveLength(5);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("annonce un seul scrutin restant et un groupe hors dossier, sans badge pour un sort inconnu", () => {
    renderScreen(
      <ScrutinsDeSeance
        titre="Votes"
        scrutins={[1, 2, 3, 4].map((n) => scrutin(n, { dossier: null, sort: "" }))}
      />,
    );
    expect(screen.getByRole("heading", { level: 4, name: "Votes (4)" })).toBeInTheDocument();
    expect(screen.getByText("Hors dossier législatif")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir l'autre scrutin" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Scrutin n° 1 :/ })[0]).toHaveAttribute(
      "href",
      "/scrutins/1?chambre=assemblee&session=17",
    );
  });
});
