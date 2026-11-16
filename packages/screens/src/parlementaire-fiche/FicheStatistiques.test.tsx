import type { ParlementaireCompare, StatsParlementaireDetail } from "@clair/data";
import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsComparees } from "../comparateur/StatsComparees.tsx";
import { renderScreen } from "../test-utils.tsx";
import { FicheStatistiques } from "./FicheStatistiques.tsx";

/** Statistiques FICTIVES : jamais présentées comme réelles. */
const stats = (patch: Partial<StatsParlementaireDetail> = {}): StatsParlementaireDetail => ({
  presence: 100,
  presenceSolennel: 73,
  loyaute: 95,
  participation: 1200,
  interventions: 10,
  amendements: { proposes: 4, adoptes: 1 },
  questions: 2,
  scrutins: 1500,
  ...patch,
});

const carte = (container: HTMLElement) => {
  const premiere = container.querySelector("li");
  if (!premiere) throw new Error("carte de présence absente");
  return premiere.textContent ?? "";
};

const fiche = (
  s: StatsParlementaireDetail,
  chambre: "assemblee" | "senat",
  fonctions: { typeOrgane: string; qualite: string | null; dateFin: string | null }[] = [],
) =>
  renderScreen(
    <FicheStatistiques
      stats={s}
      titre="Statistiques"
      calculeLe={null}
      chambre={chambre}
      fonctions={fonctions}
    />,
  );

describe("FicheStatistiques : carte de présence (#108)", () => {
  it("met la présence aux votes solennels d'un sénateur en tête, la participation en second", () => {
    const { container } = fiche(stats(), "senat");
    expect(carte(container)).toMatch(/Présence73\s%100\s% tous scrutins/);
  });

  it("explique le vote par groupe du Sénat sous la grille, pas dans la carte", () => {
    const { container, getByText } = fiche(stats(), "senat");
    expect(carte(container)).not.toMatch(/délégué dépose les bulletins/);
    const note = getByText(/délégué dépose les bulletins/);
    expect(note.closest("ul")).toBeNull();
  });

  it("dit « Participation » pour un sénateur sans scrutin solennel", () => {
    const { container } = fiche(stats({ presenceSolennel: null, presence: 98 }), "senat");
    expect(carte(container)).toMatch(/^Participation98\s%/);
  });

  it("dit « Ne vote pas » pour un président d'assemblée, avec sa présence hors présidence", () => {
    const { container } = fiche(stats({ presence: null, presenceSolennel: 81 }), "senat", [
      { typeOrgane: "BUREAU", qualite: "Président du Sénat", dateFin: null },
    ]);
    expect(carte(container)).toMatch(/Ne vote pas81\s% hors présidence/);
  });

  it("dit « Non mesurable » plutôt que 0 % sans scrutin où voter", () => {
    const { container } = fiche(stats({ presence: null, presenceSolennel: null }), "assemblee");
    expect(carte(container)).toContain("Non mesurable");
    expect(carte(container)).not.toContain("0 %");
  });

  it("signale un taux de député calculé sur moins de 50 scrutins", () => {
    const { container } = fiche(
      stats({ presenceSolennel: null, presence: 64, scrutins: 28 }),
      "assemblee",
    );
    expect(carte(container)).toContain("sur 28 scrutins seulement");
  });

  it("explique la période des chiffres", () => {
    const { getByText } = fiche(stats(), "assemblee");
    expect(getByText(/Sur toute la carrière parlementaire/)).toBeInTheDocument();
  });
});

const elu = (slug: string, s: StatsParlementaireDetail): ParlementaireCompare => ({
  id: slug,
  slug,
  chambre: "senat",
  nom: slug,
  prenom: "Camille",
  sexe: "F",
  photoUrl: null,
  actif: true,
  profession: null,
  groupe: null,
  circonscription: null,
  serie: null,
  stats: s,
});

describe("StatsComparees au Sénat (#108)", () => {
  it("compare la présence aux votes solennels, et le taux tous scrutins en participation", () => {
    const { getByRole } = renderScreen(
      <StatsComparees
        chambre="senat"
        elus={[elu("exemple", stats()), elu("test", stats({ presenceSolennel: null }))]}
      />,
    );
    const table = getByRole("table");
    expect(
      within(table).getByRole("row", {
        name: /Présence aux votes solennels 73\s% Non mesurable/,
      }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /^Participation/ })).toBeInTheDocument();
  });
});
