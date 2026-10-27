import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { PageHeader } from "./PageHeader.tsx";

const chemin = [
  { label: "Accueil", href: "/" },
  { label: "Scrutins", href: "/scrutins" },
  { label: "Scrutin n° 1234" },
];

describe("PageHeader", () => {
  it("rend un seul titre de niveau 1 et le chapeau", () => {
    const { getAllByRole, getByText } = renderWithProviders(
      <PageHeader title="Scrutins" description="Tous les votes publics des deux chambres." />,
    );
    const titres = getAllByRole("heading", { level: 1 });
    expect(titres).toHaveLength(1);
    expect(titres[0]).toHaveTextContent("Scrutins");
    expect(getByText("Tous les votes publics des deux chambres.")).toBeInTheDocument();
  });

  it("affiche les badges et les actions", () => {
    const { getByText, getByRole } = renderWithProviders(
      <PageHeader
        title="Camille Exemple"
        badges={<span>Assemblée nationale</span>}
        actions={<button type="button">Partager</button>}
      />,
    );
    expect(getByText("Assemblée nationale")).toBeInTheDocument();
    expect(getByRole("button", { name: "Partager" })).toBeInTheDocument();
  });

  it("n'affiche pas de fil d'Ariane sans chemin", () => {
    const { queryByRole } = renderWithProviders(<PageHeader title="Scrutins" />);
    expect(queryByRole("navigation", { name: "Fil d'Ariane" })).toBeNull();
  });
});

describe("Breadcrumb", () => {
  it("liste le chemin dans une navigation nommée, page courante sans lien", () => {
    const { getByRole } = renderWithProviders(<Breadcrumb items={chemin} />);
    const nav = getByRole("navigation", { name: "Fil d'Ariane" });
    const liste = within(nav).getByRole("list");
    expect(liste.tagName).toBe("OL");
    expect(within(liste).getAllByRole("listitem")).toHaveLength(3);
    expect(within(nav).getByRole("link", { name: "Scrutins" })).toHaveAttribute(
      "href",
      "/scrutins",
    );
    expect(within(nav).queryByRole("link", { name: "Scrutin n° 1234" })).toBeNull();
    expect(within(nav).getByText("Scrutin n° 1234")).toHaveAttribute("aria-current", "page");
  });
});
