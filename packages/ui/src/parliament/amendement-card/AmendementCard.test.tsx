import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { amendementAdopte, sousAmendement } from "../fixtures.ts";
import { AmendementCard } from "./AmendementCard.tsx";

describe("AmendementCard", () => {
  it("affiche le numéro, le sort, l'article visé, l'auteur et son groupe", () => {
    const { getByRole, getByText } = renderWithProviders(
      <AmendementCard amendement={amendementAdopte} groupe={{ sigle: "ECO" }} />,
    );
    expect(getByRole("heading", { name: "Amendement n° 42" })).toBeInTheDocument();
    expect(getByText("Adopté")).toHaveAttribute("data-tone", "succes");
    expect(getByText("Article 3, alinéa 2")).toBeInTheDocument();
    expect(getByText("Mme Camille Exemple")).toBeInTheDocument();
    expect(getByText("ECO")).toBeInTheDocument();
  });

  it("déplie l'exposé sommaire avec un bouton aria-expanded", async () => {
    const { getAllByRole } = renderWithProviders(<AmendementCard amendement={amendementAdopte} />);
    const [bouton] = getAllByRole("button", { name: /Lire la suite/ });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    if (bouton) await userEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
  });

  it("retire le HTML de la source", () => {
    const { container } = renderWithProviders(<AmendementCard amendement={amendementAdopte} />);
    expect(container.textContent).not.toContain("<p>");
  });

  it("mène à l'amendement parent d'un sous-amendement", () => {
    const { getByRole, getByText } = renderWithProviders(
      <AmendementCard amendement={sousAmendement} parentHref="/amendement-42" />,
    );
    expect(getByText("Sous-amendement")).toBeInTheDocument();
    expect(
      getByRole("link", { name: "l'amendement n° 42 de Mme Camille Exemple" }),
    ).toHaveAttribute("href", "/amendement-42");
    expect(getByText("Rejeté")).toBeInTheDocument();
  });

  it("mène aux scrutins et au dossier", () => {
    const { getByRole } = renderWithProviders(
      <AmendementCard
        amendement={amendementAdopte}
        scrutins={[{ numero: 1234, href: "/scrutin" }]}
        dossier={{ label: "Projet de loi d'exemple", href: "/dossier" }}
      />,
    );
    expect(getByRole("link", { name: "Voir le scrutin n° 1234" })).toHaveAttribute(
      "href",
      "/scrutin",
    );
    expect(getByRole("link", { name: "Dossier : Projet de loi d'exemple" })).toHaveAttribute(
      "href",
      "/dossier",
    );
  });
});
