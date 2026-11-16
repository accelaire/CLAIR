import type { GroupeRepartition } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { apercuExemple, sortantsExemple } from "../fixtures.ts";
import { PartRemiseEnJeu } from "./PartRemiseEnJeu.tsx";

const PAR_GROUPE = apercuExemple.sortants.parGroupe;

describe("PartRemiseEnJeu", () => {
  it("ne rend rien sans groupe", () => {
    renderScreen(<PartRemiseEnJeu parGroupe={[]} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("affiche part et effectifs, sans bouton faute de sélection", () => {
    renderScreen(<PartRemiseEnJeu parGroupe={PAR_GROUPE} />);
    expect(screen.queryByRole("button", { name: /Surligner/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Part des sièges remise en jeu, par groupe" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("50 %").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20 %").length).toBeGreaterThan(0);
  });

  it("accorde « siège » au singulier pour un groupe d'un seul siège", () => {
    const seul: GroupeRepartition = {
      slug: "groupe-seul",
      nom: "Groupe fictif seul",
      nomComplet: null,
      couleur: null,
      position: null,
      sieges: 1,
      siegesSenat: 1,
    };
    renderScreen(
      <PartRemiseEnJeu parGroupe={[seul]} sortants={sortantsExemple} onSelection={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", {
        name: "Surligner les sortants du groupe Groupe fictif seul : 1/1 siège · 100 %",
      }),
    ).toBeInTheDocument();
  });

  it("surligne les sortants d'un groupe, sans-groupe compris", () => {
    const onSelection = vi.fn();
    renderScreen(
      <PartRemiseEnJeu
        parGroupe={PAR_GROUPE}
        sortants={sortantsExemple}
        onSelection={onSelection}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Surligner les sortants du groupe Sans groupe : 1/2 sièges · 50 %",
      }),
    );
    expect(onSelection).toHaveBeenLastCalledWith(["mandat-2"], "Sans groupe");
    fireEvent.click(screen.getByRole("button", { name: /Groupe Exemple A/ }));
    expect(onSelection).toHaveBeenLastCalledWith(["mandat-1", "mandat-3"], "Groupe Exemple A");
  });

  it("montre l'infobulle d'un groupe au focus", () => {
    renderScreen(
      <PartRemiseEnJeu parGroupe={PAR_GROUPE} sortants={sortantsExemple} onSelection={vi.fn()} />,
    );
    fireEvent.focus(screen.getByRole("button", { name: /Groupe Exemple A/ }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Total au Sénat");
    expect(screen.getByRole("tooltip")).toHaveTextContent("10");
  });
});
