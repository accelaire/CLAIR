import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Badge } from "./Badge.tsx";

describe("Badge", () => {
  it("porte l'information par son libellé, quel que soit son ton (jamais la couleur seule)", () => {
    for (const tone of ["succes", "erreur", "neutre"] as const) {
      const { getByText, unmount } = renderWithProviders(<Badge tone={tone}>Adopté</Badge>);
      expect(getByText("Adopté")).toBeVisible();
      unmount();
    }
  });

  it("masque l'icône aux lecteurs d'écran", () => {
    const { container } = renderWithProviders(
      <Badge icon={<svg data-testid="icone" />}>Promulgué</Badge>,
    );
    const icone = container.querySelector("svg");
    expect(icone?.closest("[aria-hidden='true']")).not.toBeNull();
  });
});
