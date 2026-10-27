import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { etapesEnCours, etapesTerminees } from "../timeline-fixtures.ts";
import { LegislativeTimeline } from "./LegislativeTimeline.tsx";

describe("LegislativeTimeline", () => {
  it("annonce l'étape en cours en texte et la marque comme étape courante", () => {
    const { getByRole, getByText, getAllByRole } = renderWithProviders(
      <LegislativeTimeline steps={etapesEnCours} />,
    );
    expect(getByRole("heading", { level: 2, name: "Parcours législatif" })).toBeInTheDocument();
    expect(getByText("Étape en cours : 1re lecture, depuis le 4 mars 2025.")).toBeInTheDocument();
    const etapes = getAllByRole("listitem");
    expect(etapes).toHaveLength(4);
    expect(etapes[1]).toHaveAttribute("aria-current", "step");
    expect(etapes[1]).toHaveTextContent("Étape en cours : 1re lecture");
    expect(etapes[0]).toHaveTextContent("Étape franchie : 1re lecture");
    expect(etapes[2]).toHaveTextContent("Étape à venir : Commission mixte paritaire");
  });

  it("affiche les dates en français et l'issue officielle de chaque étape", () => {
    const { getByText } = renderWithProviders(<LegislativeTimeline steps={etapesTerminees} />);
    expect(getByText("Toutes les étapes sont franchies.")).toBeInTheDocument();
    expect(getByText("8 octobre 2024")).toHaveAttribute("dateTime", "2024-10-08");
    expect(getByText("Partiellement conforme")).toBeInTheDocument();
    expect(getByText("Adopté modifié")).toBeInTheDocument();
  });

  it("affiche un état vide sans étape", () => {
    const { getByText, queryByRole } = renderWithProviders(<LegislativeTimeline steps={[]} />);
    expect(getByText("Aucune étape connue pour ce dossier")).toBeInTheDocument();
    expect(queryByRole("list")).toBeNull();
  });

  it("survit à une date d'étape invalide", () => {
    const etapes = etapesEnCours.map((etape) => ({
      ...etape,
      date: etape.date ? "invalide" : etape.date,
    }));
    const { getAllByText } = renderWithProviders(<LegislativeTimeline steps={etapes} />);
    expect(getAllByText("date inconnue").length).toBeGreaterThan(0);
  });
});
