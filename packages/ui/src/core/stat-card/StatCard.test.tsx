import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { StatCard } from "./StatCard.tsx";

describe("StatCard", () => {
  it("associe le libellé au chiffre dans une liste de définitions", () => {
    const { getByRole } = renderWithProviders(<StatCard label="Présence" value={87} unit="%" />);
    expect(getByRole("term")).toHaveTextContent("Présence");
    expect(getByRole("definition")).toHaveTextContent("87 %");
  });

  it("formate les nombres en français", () => {
    const { getByRole } = renderWithProviders(<StatCard label="Interventions" value={1234.5} />);
    expect(getByRole("definition")).toHaveTextContent("1 234,5");
  });

  it("dit la variation en toutes lettres", () => {
    const { getByText } = renderWithProviders(
      <>
        <StatCard
          label="Présence"
          value={87}
          variation={{ value: 3.2, unit: "points", period: "sur un an" }}
        />
        <StatCard label="Questions" value={12} variation={{ value: -4 }} />
        <StatCard label="Votes" value={40} variation={{ value: 0 }} />
      </>,
    );
    expect(getByText("Hausse de 3,2 points sur un an")).toBeInTheDocument();
    expect(getByText("Baisse de 4")).toBeInTheDocument();
    expect(getByText("Stable")).toBeInTheDocument();
  });

  it("annonce une donnée indisponible et affiche l'aide", () => {
    const { getByRole, getByText } = renderWithProviders(
      <StatCard
        label="Présence solennelle"
        value={null}
        help="Le Sénat ne publie pas ce chiffre."
      />,
    );
    expect(getByRole("definition")).toHaveTextContent("Non disponible");
    expect(getByText("Le Sénat ne publie pas ce chiffre.")).toBeInTheDocument();
  });
});
