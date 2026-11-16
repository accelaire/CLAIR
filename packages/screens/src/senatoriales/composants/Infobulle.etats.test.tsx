import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { type ContenuInfobulle, useInfobulle } from "./Infobulle.tsx";

// Banc d'essai : trois cibles, une avec pastille, une sans, une sans contenu.
const AVEC_COULEUR: ContenuInfobulle = {
  titre: "Groupe fictif",
  couleur: "#3d6fb4",
  lignes: [
    { label: "Sièges", valeur: "12" },
    { label: "Part", valeur: "40 %" },
  ],
};
const SANS_COULEUR: ContenuInfobulle = {
  titre: "Tranche fictive",
  lignes: [{ label: "Hommes", valeur: "3" }],
};

const Banc = () => {
  const { infobulle, gestionnaires } = useInfobulle();
  return (
    <div>
      <button type="button" {...gestionnaires(AVEC_COULEUR)}>
        Cible colorée
      </button>
      <button type="button" {...gestionnaires(SANS_COULEUR)}>
        Cible neutre
      </button>
      <button type="button" {...gestionnaires(null)}>
        Cible muette
      </button>
      <p>Ailleurs</p>
      {infobulle}
    </div>
  );
};

const bulle = () => screen.getByRole("tooltip", { hidden: true });

describe("useInfobulle", () => {
  it("est cachée et vide au départ", () => {
    renderScreen(<Banc />);
    expect(bulle()).toHaveAttribute("aria-hidden", "true");
    expect(bulle()).toBeEmptyDOMElement();
  });

  it("s'ouvre au survol avec le titre et les lignes, suit la souris, se ferme en sortant", () => {
    renderScreen(<Banc />);
    const cible = screen.getByRole("button", { name: "Cible colorée" });
    fireEvent.mouseEnter(cible, { clientX: 10, clientY: 10 });
    expect(bulle()).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Groupe fictif");
    expect(screen.getByText("Sièges")).toBeInTheDocument();
    expect(screen.getByText("40 %")).toBeInTheDocument();
    // Près du bord de la fenêtre, la bulle se replace de l'autre côté.
    fireEvent.mouseMove(cible, { clientX: 5000, clientY: 5000 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Groupe fictif");
    fireEvent.mouseLeave(cible);
    expect(bulle()).toHaveAttribute("aria-hidden", "true");
    expect(bulle()).toBeEmptyDOMElement();
  });

  it("s'ouvre au focus clavier et se ferme à la perte du focus", () => {
    renderScreen(<Banc />);
    const cible = screen.getByRole("button", { name: "Cible neutre" });
    fireEvent.focus(cible);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Tranche fictive");
    expect(screen.getByText("Hommes")).toBeInTheDocument();
    fireEvent.blur(cible);
    expect(bulle()).toHaveAttribute("aria-hidden", "true");
  });

  it("s'ouvre au toucher et se ferme au toucher en dehors", () => {
    renderScreen(<Banc />);
    const cible = screen.getByRole("button", { name: "Cible colorée" });
    fireEvent.touchStart(cible, { touches: [{ clientX: 20, clientY: 30 }] });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Groupe fictif");
    fireEvent.touchStart(screen.getByText("Ailleurs"));
    expect(bulle()).toHaveAttribute("aria-hidden", "true");
  });

  it("reste ouverte quand on touche sans point de contact, puis au clic dans la bulle", () => {
    renderScreen(<Banc />);
    const cible = screen.getByRole("button", { name: "Cible colorée" });
    fireEvent.touchStart(cible, { touches: [] });
    expect(bulle()).toHaveAttribute("aria-hidden", "false");
    fireEvent.mouseDown(screen.getByText("Groupe fictif"));
    expect(bulle()).toHaveAttribute("aria-hidden", "false");
    fireEvent.mouseDown(screen.getByText("Ailleurs"));
    expect(bulle()).toHaveAttribute("aria-hidden", "true");
  });

  it("ne s'ouvre pas sur une cible sans contenu", () => {
    renderScreen(<Banc />);
    const cible = screen.getByRole("button", { name: "Cible muette" });
    fireEvent.mouseEnter(cible, { clientX: 10, clientY: 10 });
    fireEvent.focus(cible);
    fireEvent.touchStart(cible, { touches: [{ clientX: 1, clientY: 1 }] });
    expect(bulle()).toHaveAttribute("aria-hidden", "true");
    expect(bulle()).toBeEmptyDOMElement();
  });
});
