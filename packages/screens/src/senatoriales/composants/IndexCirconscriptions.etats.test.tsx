import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { apercuAvecCandidatures, apercuExemple } from "../fixtures.ts";
import { IndexCirconscriptions } from "./IndexCirconscriptions.tsx";

describe("IndexCirconscriptions", () => {
  it("ne rend rien sans circonscription", () => {
    renderScreen(<IndexCirconscriptions circonscriptions={[]} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("annonce le mode de scrutin seul tant que les candidats ne sont pas connus", () => {
    renderScreen(
      <IndexCirconscriptions
        circonscriptions={[
          ...apercuExemple.circonscriptions,
          { departement: "000", nom: "Circonscription fictive (Série 2)", nbSieges: 1 },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Les 3 circonscriptions concernées" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Le mode de scrutin et le bilan/)).toBeInTheDocument();
    expect(screen.getByText("1 siège")).toBeInTheDocument();
    // Code inconnu : lien vers la rubrique, libellé sans rappel de série.
    expect(screen.getByRole("link", { name: /Circonscription fictive/ })).toHaveAttribute(
      "href",
      "/senatoriales-2026/",
    );
  });

  it("donne le nombre de candidats une fois publiés", () => {
    renderScreen(
      <IndexCirconscriptions circonscriptions={apercuAvecCandidatures.circonscriptions} />,
    );
    expect(screen.getByText(/^Les candidats, le mode de scrutin/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gironde/ })).toHaveTextContent("16 cand. · 6 sièges");
  });

  it("se replie en mobile derrière un bouton qui garde les liens dans la page", () => {
    renderScreen(<IndexCirconscriptions circonscriptions={apercuExemple.circonscriptions} />);
    // Le bouton n'est affiché que sous 640 px (jsdom rend une fenêtre plus large) : il est
    // cherché par son texte.
    const bouton = screen.getByText(/Afficher les \d+ circonscriptions/).closest("button");
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
    if (bouton) fireEvent.click(bouton);
    expect(
      screen.getByText("Masquer la liste des circonscriptions").closest("button"),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
