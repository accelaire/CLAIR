import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { amendementAdopte, amendementAvecRenvoi, sousAmendement } from "../fixtures.ts";
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

  it("lie à Légifrance les articles cités par le dispositif, en texte", () => {
    const { getByRole, container } = renderWithProviders(
      <AmendementCard amendement={amendementAvecRenvoi} />,
    );
    const lien = getByRole("link", { name: /l'article L\. 123-4 du code de l'exemple/ });
    expect(lien).toHaveAttribute(
      "href",
      "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000000000001/2026-01-12",
    );
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien).toHaveAccessibleName(/Légifrance, nouvel onglet/);
    expect(container.textContent).toContain("À l'article L. 123-4");
    expect(container.textContent).not.toContain("<p>");
  });

  it("résume une longue liste d'auteurs en « X et N cosignataires »", () => {
    const { getByText } = renderWithProviders(
      <AmendementCard
        amendement={{
          ...amendementAdopte,
          auteurLibelle:
            "Mme Camille Exemple, M. Alex Fictif, Mme Claude Modèle et M. Dominique Test",
        }}
      />,
    );
    expect(getByText("Mme Camille Exemple et 3 cosignataires")).toBeInTheDocument();
    expect(getByText(/M\. Dominique Test/)).toBeInTheDocument();
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

  it("dans une liste, est lui-même l'élément de liste", () => {
    const { container } = renderWithProviders(
      <ul>
        <AmendementCard amendement={amendementAdopte} as="li" />
      </ul>,
    );
    const liste = container.querySelector("ul");
    expect(liste?.children).toHaveLength(1);
    expect(liste?.firstElementChild?.tagName).toBe("LI");
    expect(container.querySelectorAll("li li")).toHaveLength(0);
  });
});
