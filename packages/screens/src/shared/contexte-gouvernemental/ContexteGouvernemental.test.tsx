import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { ContexteGouvernementalBandeau, MotionCensureBandeau } from "./ContexteGouvernemental.tsx";
import { contexteGouvernementalExemple, motionAdopteeExemple } from "./fixtures.ts";

describe("ContexteGouvernementalBandeau", () => {
  it("n'affiche rien sans contexte", () => {
    const { queryByRole } = renderScreen(<ContexteGouvernementalBandeau contexte={null} />);
    expect(queryByRole("region")).toBeNull();
  });

  it("présente le projet, ses signataires, le 49.3 et ses motions", () => {
    const { getByRole, getAllByRole, getByText } = renderScreen(
      <ContexteGouvernementalBandeau contexte={contexteGouvernementalExemple} />,
    );
    expect(getByRole("region", { name: "Le Gouvernement et ce texte" })).toBeInTheDocument();
    expect(getByText("Projet de loi du Gouvernement")).toBeInTheDocument();
    const liensGouvernement = getAllByRole("link", { name: "gouvernement Exemple" });
    expect(liensGouvernement[0]).toHaveAttribute("href", "/gouvernements/exemple#textes");
    expect(liensGouvernement[1]).toHaveAttribute("href", "/gouvernements/exemple#censure");
    expect(getByText("adopté, pas encore promulgué")).toBeInTheDocument();
    expect(getByText(/Porté par/)).toHaveTextContent(
      "Porté par Alex Fictif (ministre · exemple), au nom du Premier ministre Camille Exemple.",
    );
    expect(getByText("Recours à l’article 49, alinéa 3")).toBeInTheDocument();
    expect(getByRole("link", { name: "le projet de loi d'exemple" })).toHaveAttribute(
      "href",
      "/dossiers/DLENGAGEMENT1",
    );
    expect(getByRole("link", { name: "scrutin du 3 février 2026" })).toHaveAttribute(
      "href",
      "/scrutins/42?chambre=assemblee&session=17",
    );
  });

  it("nomme le texte visé sur la page du dossier d'engagement", () => {
    const { getByRole } = renderScreen(
      <ContexteGouvernementalBandeau
        contexte={contexteGouvernementalExemple}
        dossierUid="DLENGAGEMENT1"
      />,
    );
    expect(getByRole("link", { name: "Projet de loi d'exemple" })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE1",
    );
  });
});

describe("MotionCensureBandeau", () => {
  it("n'affiche rien hors motion de censure", () => {
    const { queryByRole } = renderScreen(<MotionCensureBandeau motion={null} />);
    expect(queryByRole("region")).toBeNull();
  });

  it("dit le gouvernement visé, le 49.3, la majorité et le résultat en texte", () => {
    const { getByRole, getByText } = renderScreen(
      <MotionCensureBandeau motion={motionAdopteeExemple} />,
    );
    expect(
      getByRole("heading", {
        name: "Motion de censure · article 49, alinéa 3 (en réponse à un 49.3)",
      }),
    ).toBeInTheDocument();
    expect(getByRole("link", { name: "gouvernement Exemple" })).toHaveAttribute(
      "href",
      "/gouvernements/exemple#censure",
    );
    expect(getByText("adoptée, le gouvernement est renversé")).toBeInTheDocument();
    expect(getByText(/300 voix pour, 289 requises/)).toBeInTheDocument();
  });
});
