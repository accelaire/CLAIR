import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ProvenanceLabel } from "./ProvenanceLabel.tsx";

describe("ProvenanceLabel", () => {
  it("distingue les trois natures de donnée par un libellé", () => {
    const { getByText } = renderWithProviders(
      <>
        <ProvenanceLabel provenance="officielle" />
        <ProvenanceLabel provenance="calculee" />
        <ProvenanceLabel provenance="ia" />
      </>,
    );
    expect(getByText("Donnée officielle")).toHaveAttribute("data-tone", "info");
    expect(getByText("Calculée par CLAIR")).toHaveAttribute("data-tone", "neutre");
    expect(getByText("Générée par IA, à vérifier")).toHaveAttribute("data-tone", "avertissement");
  });

  it("ajoute le producteur de la donnée", () => {
    const { getByText } = renderWithProviders(
      <ProvenanceLabel provenance="officielle" source="Assemblée nationale" />,
    );
    expect(getByText("Donnée officielle · Assemblée nationale")).toBeInTheDocument();
  });

  it("mène à la méthodologie", () => {
    const { getByRole } = renderWithProviders(
      <ProvenanceLabel provenance="ia" methodologyHref="/methodologie#ia" />,
    );
    expect(
      getByRole("link", { name: "Générée par IA, à vérifier (méthodologie)" }),
    ).toHaveAttribute("href", "/methodologie#ia");
  });

  it("masque l'icône aux lecteurs d'écran", () => {
    const { container } = renderWithProviders(<ProvenanceLabel provenance="calculee" />);
    expect(container.querySelector("[aria-hidden='true'] svg")).not.toBeNull();
  });
});
