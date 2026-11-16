import type { SujetVoteEtape } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { VotesDeLEtape } from "./VotesDeLEtape.tsx";

// Votes fictifs.
const vote = (numero: number, sort: string): SujetVoteEtape => ({
  id: `v${numero}`,
  numero,
  titre: `article fictif ${numero}`,
  date: "2026-03-03",
  sort,
  chambre: "senat",
  session: "2025",
  nombrePour: 200,
  nombreContre: 100,
  nombreAbstention: 0,
});

describe("VotesDeLEtape", () => {
  it("ne rend rien sans vote", () => {
    const { container } = renderScreen(<VotesDeLEtape scrutins={[]} date="3 mars 2026" />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("replie un vote unique derrière un bouton au singulier", () => {
    renderScreen(<VotesDeLEtape scrutins={[vote(1, "adopté")]} date="3 mars 2026" />);
    const bouton = screen.getByRole("button", { name: /1 vote de l'étape du 3 mars 2026/ });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Scrutin n° 1 : article fictif 1" })).toHaveAttribute(
      "href",
      "/scrutins/1?chambre=senat&session=2025",
    );
    expect(screen.getByText("200 pour, 100 contre")).toBeInTheDocument();
  });

  it("écrit le sort brut d'un vote au sort inconnu, au pluriel", () => {
    renderScreen(<VotesDeLEtape scrutins={[vote(1, "rejeté"), vote(2, "")]} date="3 mars 2026" />);
    fireEvent.click(screen.getByRole("button", { name: /2 votes/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
