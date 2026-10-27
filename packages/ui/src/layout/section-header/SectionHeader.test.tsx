import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { SectionHeader } from "./SectionHeader.tsx";

describe("SectionHeader", () => {
  it("rend un titre de niveau 2 par défaut, sans lien", () => {
    const { getByRole, queryByRole } = renderWithProviders(
      <SectionHeader title="Scrutins récents" description="Les derniers votes publics." />,
    );
    expect(getByRole("heading", { level: 2, name: "Scrutins récents" })).toBeInTheDocument();
    expect(queryByRole("link")).toBeNull();
  });

  it("accepte un titre de niveau 3", () => {
    const { getByRole } = renderWithProviders(<SectionHeader title="Amendements" level={3} />);
    expect(getByRole("heading", { level: 3, name: "Amendements" })).toBeInTheDocument();
  });

  it("nomme le lien « Voir tout » par le titre de la section", () => {
    const { getByRole } = renderWithProviders(
      <SectionHeader title="Scrutins récents" seeAllHref="/scrutins" />,
    );
    expect(getByRole("link", { name: "Voir tout : Scrutins récents" })).toHaveAttribute(
      "href",
      "/scrutins",
    );
  });
});
