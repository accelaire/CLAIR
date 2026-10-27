import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ChambreBadge } from "./ChambreBadge.tsx";

describe("ChambreBadge", () => {
  it("affiche le nom complet de la chambre", () => {
    const { getByText } = renderWithProviders(<ChambreBadge chambre="assemblee" />);
    expect(getByText("Assemblée nationale")).toHaveAttribute("data-chambre", "assemblee");
  });

  it("garde le nom complet accessible en version courte", () => {
    const { getByText, getByTitle } = renderWithProviders(
      <ChambreBadge chambre="assemblee" short />,
    );
    expect(getByText("AN")).toHaveAttribute("aria-hidden", "true");
    expect(getByText("Assemblée nationale")).toHaveClass("clair-visually-hidden");
    expect(getByTitle("Assemblée nationale")).toHaveAttribute("data-chambre", "assemblee");
  });

  it("n'abrège pas « Sénat »", () => {
    const { getByText } = renderWithProviders(<ChambreBadge chambre="senat" short />);
    expect(getByText("Sénat")).not.toHaveAttribute("aria-hidden");
  });
});
