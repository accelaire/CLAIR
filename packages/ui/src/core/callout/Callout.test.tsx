import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Callout } from "./Callout.tsx";

describe("Callout", () => {
  it("affiche son titre, son contenu et son action", () => {
    const { getByRole, getByText } = renderWithProviders(
      <Callout
        tone="mise-en-avant"
        title="Aller plus loin"
        action={{ label: "Voir le classement", href: "/classements" }}
      >
        Présence, loyauté et interventions face aux autres élus.
      </Callout>,
    );
    expect(getByRole("heading", { level: 3, name: "Aller plus loin" })).toBeInTheDocument();
    expect(
      getByText("Présence, loyauté et interventions face aux autres élus."),
    ).toBeInTheDocument();
    expect(getByRole("link", { name: "Voir le classement" })).toHaveAttribute(
      "href",
      "/classements",
    );
  });

  it("devient un repère nommé par son titre en section", () => {
    const { getByRole } = renderWithProviders(
      <Callout as="section" title="Le nouveau Sénat est installé" titleAs="h2">
        178 sièges renouvelés.
      </Callout>,
    );
    expect(getByRole("region", { name: "Le nouveau Sénat est installé" })).toBeInTheDocument();
  });

  it("annonce une action externe comme ouvrant une nouvelle fenêtre", () => {
    const { getByRole } = renderWithProviders(
      <Callout
        tone="avertissement"
        action={{ label: "Site du Sénat", href: "https://www.senat.fr", external: true }}
      >
        Données en cours de mise à jour.
      </Callout>,
    );
    expect(getByRole("link", { name: "Site du Sénat (nouvelle fenêtre)" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("masque l'icône aux lecteurs d'écran", () => {
    const { container } = renderWithProviders(<Callout>Information.</Callout>);
    expect(container.querySelector("[aria-hidden='true'] svg")).not.toBeNull();
  });
});
