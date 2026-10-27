import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { commissionsExemple, seriesVotesExemple, votesParMoisExemple } from "../fixtures.ts";
import { BarChart } from "./BarChart.tsx";

describe("BarChart", () => {
  it("masque le dessin aux lecteurs d'écran (l'alternative est le tableau du ChartFrame)", () => {
    const { container } = renderWithProviders(
      <BarChart data={votesParMoisExemple} categoryKey="mois" series={seriesVotesExemple} />,
    );
    // Le graphique de Mantine (recharts) est entièrement sous l'ancêtre masqué ; hors de lui, seule
    // reste la légende en texte. (happy-dom ne dessine pas le SVG : on vérifie son conteneur.)
    const graphique = container.querySelector(".mantine-BarChart-root");
    expect(graphique).not.toBeNull();
    expect(graphique?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("donne la légende des séries en texte", () => {
    const { getByRole } = renderWithProviders(
      <BarChart
        data={votesParMoisExemple}
        categoryKey="mois"
        series={seriesVotesExemple}
        type="stacked"
      />,
    );
    const legende = getByRole("list", { name: "Légende" });
    expect(legende).toHaveTextContent("Pour");
    expect(legende).toHaveTextContent("Contre");
    expect(legende).toHaveTextContent("Abstention");
  });

  it("n'affiche pas de légende pour une seule série", () => {
    const { queryByRole } = renderWithProviders(
      <BarChart
        data={commissionsExemple}
        categoryKey="commission"
        series={[{ key: "membres", label: "Membres" }]}
        horizontal
      />,
    );
    expect(queryByRole("list", { name: "Légende" })).toBeNull();
  });
});

describe("BarChart vide", () => {
  it("affiche un état vide plutôt qu'un graphique sans barres", () => {
    const { getByText, queryByRole } = renderWithProviders(
      <BarChart data={[]} categoryKey="mois" series={seriesVotesExemple} />,
    );
    expect(getByText("Aucune donnée à représenter")).toBeInTheDocument();
    expect(queryByRole("list", { name: "Légende" })).toBeNull();
  });

  it("nomme sa légende quand on le lui demande (plusieurs graphiques sur la page)", () => {
    const { getByRole } = renderWithProviders(
      <BarChart
        data={votesParMoisExemple}
        categoryKey="mois"
        series={seriesVotesExemple}
        legendLabel="Légende : votes par mois"
      />,
    );
    expect(getByRole("list", { name: "Légende : votes par mois" })).toBeInTheDocument();
  });
});
