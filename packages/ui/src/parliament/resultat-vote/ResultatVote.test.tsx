import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ResultatVote } from "./ResultatVote.tsx";

describe("ResultatVote", () => {
  it("donne les valeurs et les pourcentages en texte", () => {
    const { getByRole, getAllByRole } = renderWithProviders(
      <ResultatVote pour={60} contre={30} abstention={10} />,
    );
    expect(getByRole("figure")).toHaveTextContent("Répartition des voix");
    const items = getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/Pour\s*60 \(60\s%\)/);
    expect(items[1]).toHaveTextContent(/Contre\s*30 \(30\s%\)/);
    expect(items[2]).toHaveTextContent(/Abstention\s*10 \(10\s%\)/);
  });

  it("masque la barre, purement visuelle", () => {
    const { queryByRole } = renderWithProviders(
      <ResultatVote pour={60} contre={30} abstention={10} />,
    );
    expect(queryByRole("progressbar")).toBeNull();
  });

  it("annonce l'absence de voix", () => {
    const { getByText } = renderWithProviders(<ResultatVote pour={0} contre={0} abstention={0} />);
    expect(getByText("Aucune voix exprimée.")).toBeInTheDocument();
  });

  it("dit à l'écran que les pourcentages sont calculés sur les votants", () => {
    const { getByText } = renderWithProviders(
      <ResultatVote pour={60} contre={30} abstention={10} />,
    );
    expect(getByText(/calculés par CLAIR sur les votants/)).toBeVisible();
  });
});
