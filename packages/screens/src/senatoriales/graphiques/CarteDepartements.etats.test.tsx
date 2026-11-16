import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import type { SiegesDepartement } from "../lib/graphiques.ts";
import { CarteDepartements } from "./CarteDepartements.tsx";

// Sièges fictifs : deux départements, une collectivité dessinée, une sans contour.
const SIEGES: SiegesDepartement[] = [
  { code: "01", nom: "Ain", sieges: 1 },
  { code: "33", nom: "Gironde", sieges: 6 },
  { code: "987", nom: "Polynésie française", sieges: 2 },
  { code: "999", nom: "Collectivité fictive", sieges: 1 },
];

const carte = () => screen.getByRole("img", { name: /Carte des départements/ });

describe("CarteDepartements", () => {
  it("affiche la légende et rien hors métropole quand il n'y a que la métropole", () => {
    renderScreen(<CarteDepartements sieges={[{ code: "33", nom: "Gironde", sieges: 1 }]} />);
    expect(screen.getByRole("heading", { name: "Sièges renouvelés" })).toBeInTheDocument();
    expect(screen.getByText("non concerné")).toBeInTheDocument();
    expect(screen.queryByText(/Hors métropole/)).not.toBeInTheDocument();
  });

  it("présente l'outre-mer en vignettes non cliquables sans sélection", () => {
    renderScreen(<CarteDepartements sieges={SIEGES} />);
    expect(screen.getByRole("heading", { name: /Hors métropole · 3 sièges/ })).toBeInTheDocument();
    expect(screen.getAllByText("Polynésie française")).toHaveLength(2);
    expect(screen.getByText("sièges renouvelés")).toBeInTheDocument();
    expect(screen.getByText("siège renouvelé")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Polynésie/ })).not.toBeInTheDocument();
    // Légende : une classe par effectif, les deux plus hauts regroupés.
    expect(screen.getByText("5–6")).toBeInTheDocument();
  });

  it("accorde le singulier pour un seul siège hors métropole", () => {
    renderScreen(
      <CarteDepartements sieges={[{ code: "999", nom: "Collectivité fictive", sieges: 1 }]} />,
    );
    expect(screen.getByRole("heading", { name: /Hors métropole · 1 siège/ })).toBeInTheDocument();
  });

  it("sélectionne et désélectionne une vignette", () => {
    const onSelect = vi.fn();
    const { unmount } = renderScreen(<CarteDepartements sieges={SIEGES} onSelect={onSelect} />);
    const vignette = screen.getByRole("button", { name: /Polynésie française/ });
    expect(vignette).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(vignette);
    expect(onSelect).toHaveBeenLastCalledWith("987");
    unmount();

    renderScreen(<CarteDepartements sieges={SIEGES} selection="987" onSelect={onSelect} />);
    const choisie = screen.getByRole("button", { name: /Polynésie française/ });
    expect(choisie).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(choisie);
    expect(onSelect).toHaveBeenLastCalledWith("");
  });

  it("sélectionne un département au clic sur la carte, ignore ceux sans siège", () => {
    const onSelect = vi.fn();
    const { container } = renderScreen(
      <CarteDepartements sieges={SIEGES} selection="33" onSelect={onSelect} />,
    );
    const chemins = carte().querySelectorAll("path");
    const actifs = Array.from(chemins).filter((p) => p.getAttribute("cursor") === "pointer");
    expect(actifs).toHaveLength(2);
    for (const chemin of actifs) fireEvent.click(chemin);
    expect(onSelect.mock.calls.map(([code]) => code).sort()).toEqual(["", "01"]);
    const inactif = Array.from(chemins).find((p) => p.getAttribute("cursor") === null);
    fireEvent.click(inactif as SVGPathElement);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(container).toBeTruthy();
  });

  it("montre en infobulle le nom ou l'absence de renouvellement", () => {
    renderScreen(<CarteDepartements sieges={SIEGES} />);
    const chemins = Array.from(carte().querySelectorAll("path"));
    const inactif = chemins.find((p) => p.getAttribute("cursor") === null);
    fireEvent.mouseEnter(inactif as SVGPathElement, { clientX: 1, clientY: 1 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("aucun siège en 2026");
    fireEvent.mouseLeave(inactif as SVGPathElement);
    fireEvent.mouseEnter(screen.getAllByText("Polynésie française")[0] as HTMLElement, {
      clientX: 1,
      clientY: 1,
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Polynésie française");
  });

  it("reprend toutes les circonscriptions dans le tableau des données", () => {
    renderScreen(<CarteDepartements sieges={SIEGES} />);
    const tableau = screen.getByRole("table", { name: "Sièges renouvelés par département" });
    expect(within(tableau).getAllByRole("row")).toHaveLength(5);
  });
});
