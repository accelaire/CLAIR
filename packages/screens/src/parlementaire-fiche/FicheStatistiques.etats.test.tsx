import type { StatsParlementaireDetail } from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { FicheStatistiques } from "./FicheStatistiques.tsx";

/** Statistiques FICTIVES. */
const stats = (patch: Partial<StatsParlementaireDetail> = {}): StatsParlementaireDetail => ({
  presence: 90,
  presenceSolennel: null,
  loyaute: 95,
  participation: 1200,
  interventions: 10,
  amendements: { proposes: 4, adoptes: 1 },
  questions: 2,
  scrutins: 1500,
  ...patch,
});

const carte = (container: HTMLElement) => container.querySelector("li")?.textContent ?? "";

describe("FicheStatistiques, variantes", () => {
  it("dit « Ne vote pas » pour la présidente de l'Assemblée, sans second chiffre", () => {
    const { container } = renderScreen(
      <FicheStatistiques
        stats={stats({ presence: null })}
        titre="Statistiques"
        calculeLe="2026-10-26T00:00:00.000Z"
        chambre="assemblee"
        fonctions={[
          { typeOrgane: "BUREAU", qualite: "Présidente de l’Assemblée nationale", dateFin: null },
        ]}
      />,
    );
    expect(carte(container)).toMatch(/^PrésenceNe vote pasPar usage, le président de l'Assemblée/);
    expect(carte(container)).not.toContain("hors présidence");
    expect(screen.getByText("Calcul du 26 octobre 2026")).toBeInTheDocument();
  });

  it("met la présence aux votes solennels d'un député en tête", () => {
    const { container } = renderScreen(
      <FicheStatistiques
        stats={stats({ presenceSolennel: 80 })}
        titre="Statistiques"
        calculeLe={null}
        chambre="assemblee"
      />,
    );
    expect(carte(container)).toMatch(/Présence80\s%90\s% tous scrutins/u);
  });

  it("accorde « scrutin » au singulier et omet le détail sans nombre de scrutins", () => {
    const un = renderScreen(
      <FicheStatistiques
        stats={stats({ scrutins: 1 })}
        titre="Statistiques"
        calculeLe={null}
        chambre="assemblee"
      />,
    );
    expect(carte(un.container)).toContain("sur 1 scrutin seulement");
    un.unmount();
    const inconnu = renderScreen(
      <FicheStatistiques
        stats={stats({ scrutins: undefined })}
        titre="Statistiques"
        calculeLe={null}
        chambre="assemblee"
      />,
    );
    expect(carte(inconnu.container)).toMatch(/^Présence90\s%Part des scrutins/u);
  });

  it("écrit un tiret sans loyauté mesurable et accorde les amendements adoptés", () => {
    renderScreen(
      <FicheStatistiques
        stats={stats({ loyaute: null, amendements: { proposes: 5, adoptes: 3 } })}
        titre="Bilan de son mandat"
        calculeLe={null}
        chambre="senat"
      />,
    );
    expect(screen.getByText("aucun vote à comparer")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("3 adoptés")).toBeInTheDocument();
  });
});
