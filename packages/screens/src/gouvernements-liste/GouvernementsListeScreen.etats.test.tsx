import type { GouvernementResume, GouvernementsReponse } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { gouvernementsFixture } from "./fixtures.ts";
import { GouvernementsListeScreen, parPresidence } from "./GouvernementsListeScreen.tsx";

const MAINTENANT = Date.parse("2026-11-01T11:00:00Z");

const enCours = gouvernementsFixture.data.find((g) => g.enCours);
if (!enCours) throw new Error("fixture sans gouvernement en fonction");
// Décompte des femmes absent (champ facultatif de l'API).
const { nbFemmes: _nbFemmes, ...sansFemmes } = enCours;

/** Gouvernements FICTIFS sans présidence, sans Premier ministre ni décompte des femmes. */
const sansPresidence: GouvernementResume = {
  ...sansFemmes,
  uid: "PO-FICTIF-X",
  slug: "fictif-x",
  nom: "Fictif X",
  dateDebut: "2020-01-01",
  enCours: true,
  dateFin: null,
  presidence: null,
  premierMinistre: null,
  bilan: null,
};
const court: GouvernementResume = {
  ...sansPresidence,
  uid: "PO-FICTIF-Y",
  slug: "fictif-y",
  nom: "Fictif Y",
  enCours: false,
  dateDebut: "2019-01-01",
  dateFin: "2019-03-01",
};

const reponse = (data: GouvernementResume[]): GouvernementsReponse => ({
  ...gouvernementsFixture,
  data,
});

describe("GouvernementsListeScreen : cas limites", () => {
  it("regroupe les gouvernements sans présidence à part", () => {
    expect(parPresidence([sansPresidence, court]).map((g) => g.titre)).toEqual([
      "Présidence non renseignée",
    ]);
  });

  it("affiche une carte sans Premier ministre ni décompte des femmes, comparée à elle-même", () => {
    const { getByRole, getByText } = renderScreen(
      <GouvernementsListeScreen
        initialData={reponse([sansPresidence, court])}
        maintenant={MAINTENANT}
      />,
      { routes: {} },
    );
    expect(
      getByRole("heading", { level: 2, name: "Présidence non renseignée" }),
    ).toBeInTheDocument();
    const carte = getByRole("link", { name: "Gouvernement Fictif X" }).closest("li");
    expect(carte).toHaveTextContent(`${sansPresidence.nbMembres} membres`);
    expect(carte).not.toHaveTextContent("dont");
    expect(carte).not.toHaveTextContent("Premier ministre");
    expect(carte).toHaveTextContent("en cours");
    // Le gouvernement en fonction est le plus long : la légende le prend pour référence.
    expect(getByText(/comparée au plus long de cette présidence : Fictif X/)).toBeInTheDocument();
  });

  it("annonce une liste vide", () => {
    const { getByText } = renderScreen(
      <GouvernementsListeScreen initialData={reponse([])} maintenant={MAINTENANT} />,
      { routes: {} },
    );
    expect(getByText("Aucun gouvernement enregistré")).toBeInTheDocument();
  });

  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<GouvernementsListeScreen maintenant={MAINTENANT} />, {
      routes: { "/gouvernements": () => new Promise(() => undefined) },
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des gouvernements");
  });
});
