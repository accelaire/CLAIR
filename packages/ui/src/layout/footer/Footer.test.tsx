import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Footer } from "./Footer.tsx";
import { footerExemple } from "./fixtures.ts";

describe("Footer", () => {
  it("range les liens dans des navigations nommées", () => {
    const { getByRole } = renderWithProviders(<Footer {...footerExemple} />);
    const legal = getByRole("navigation", { name: "Légal" });
    expect(legal).toBeInTheDocument();
    expect(getByRole("link", { name: "CGU" })).toHaveAttribute("href", "/cgu");
  });

  it("cite les sources comme liens externes", () => {
    const { getByRole } = renderWithProviders(<Footer {...footerExemple} />);
    expect(getByRole("link", { name: "Sénat (nouvelle fenêtre)" })).toHaveAttribute(
      "href",
      "https://data.senat.fr",
    );
  });

  it("garde la ligne © sans sources, avec l'année et la marque fournies", () => {
    const { getByText, getByRole } = renderWithProviders(
      <Footer columns={[]} year={2026} brand="CLAIR.vote" />,
    );
    expect(getByText("© 2026 CLAIR.vote.")).toBeInTheDocument();
    expect(getByRole("link", { name: "CLAIR.vote, accueil" })).toHaveAttribute("href", "/");
  });
});
