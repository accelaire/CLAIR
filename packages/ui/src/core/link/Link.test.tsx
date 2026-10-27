import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Link } from "./Link.tsx";

describe("Link", () => {
  it("rend un lien interne par le routeur de l'application", () => {
    const { getByRole } = renderWithProviders(<Link href="/deputes">Voir les députés</Link>);
    expect(getByRole("link", { name: "Voir les députés" })).toHaveAttribute("href", "/deputes");
  });

  it("annonce un lien externe comme ouvrant une nouvelle fenêtre", () => {
    const { getByRole } = renderWithProviders(
      <Link href="https://www.senat.fr" external>
        Site du Sénat
      </Link>,
    );
    const link = getByRole("link", { name: "Site du Sénat (nouvelle fenêtre)" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
