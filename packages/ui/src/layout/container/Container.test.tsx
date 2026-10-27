import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Container } from "./Container.tsx";

describe("Container", () => {
  it("rend un bloc de largeur normale par défaut", () => {
    const { getByText } = renderWithProviders(<Container>Contenu</Container>);
    const container = getByText("Contenu");
    expect(container.tagName).toBe("DIV");
    expect(container).toHaveAttribute("data-size", "normal");
  });

  it("rend une section nommée en colonne de lecture", () => {
    const { getByRole } = renderWithProviders(
      <Container as="section" size="etroit" aria-labelledby="titre">
        <h2 id="titre">Méthodologie</h2>
      </Container>,
    );
    const section = getByRole("region", { name: "Méthodologie" });
    expect(section).toHaveAttribute("data-size", "etroit");
  });
});
