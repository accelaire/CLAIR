import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Card } from "./Card.tsx";

describe("Card", () => {
  it("affiche un titre du niveau demandé, le contenu et le pied", () => {
    const { getByRole, getByText } = renderWithProviders(
      <Card title="Camille Exemple" titleAs="h2" footer="Mis à jour le 3 mars 2026">
        Députée de la 1re circonscription
      </Card>,
    );
    expect(getByRole("heading", { level: 2, name: "Camille Exemple" })).toBeInTheDocument();
    expect(getByText("Députée de la 1re circonscription")).toBeInTheDocument();
    expect(getByText("Mis à jour le 3 mars 2026")).toBeInTheDocument();
  });

  it("rend la carte cliquable avec un seul lien, porté par le titre", () => {
    const { getAllByRole, getByRole } = renderWithProviders(
      <Card as="article" title="Camille Exemple" href="/deputes/camille-exemple">
        Groupe RN
      </Card>,
    );
    expect(getAllByRole("link")).toHaveLength(1);
    const heading = getByRole("heading", { level: 3 });
    const link = getByRole("link", { name: "Camille Exemple" });
    expect(heading).toContainElement(link);
    expect(link).toHaveAttribute("href", "/deputes/camille-exemple");
    expect(getByRole("article")).toBeInTheDocument();
  });

  it("annonce un lien externe comme ouvrant une nouvelle fenêtre", () => {
    const { getByRole } = renderWithProviders(
      <Card title="Données de l'Assemblée" href="https://data.assemblee-nationale.fr" external />,
    );
    expect(
      getByRole("link", { name: "Données de l'Assemblée (nouvelle fenêtre)" }),
    ).toHaveAttribute("target", "_blank");
  });

  it("n'affiche aucun lien sans adresse", () => {
    const { queryByRole } = renderWithProviders(<Card>Contenu</Card>);
    expect(queryByRole("link")).toBeNull();
    expect(queryByRole("heading")).toBeNull();
  });
});
