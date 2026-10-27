import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { mandatsExemple, mandatUnique } from "../timeline-fixtures.ts";
import { MandatsTimeline } from "./MandatsTimeline.tsx";

describe("MandatsTimeline", () => {
  it("liste les mandats du plus récent au plus ancien et nomme la fonction quand les chambres changent", () => {
    const { getByRole } = renderWithProviders(
      <MandatsTimeline mandats={mandatsExemple} sexe="F" />,
    );
    const liste = getByRole("list", { name: "Mandats" });
    const mandats = liste.querySelectorAll(":scope > [role='listitem']");
    expect(mandats).toHaveLength(2);
    expect(mandats[0]).toHaveTextContent("Sénatrice · Mandature 2023");
    expect(mandats[0]).toHaveTextContent("En cours");
    expect(mandats[1]).toHaveTextContent("Députée · XVIe législature");
    expect(mandats[1]).toHaveTextContent("juin 2022 – septembre 2023");
  });

  it("donne le groupe d'époque en texte, avec son sigle", () => {
    const { getByRole, getByText } = renderWithProviders(
      <MandatsTimeline mandats={mandatsExemple} />,
    );
    expect(getByRole("link", { name: "Union centriste" })).toHaveAttribute("href", "#groupe");
    expect(getByText(/Démocrate \(MoDem et indépendants\) \(DEM\)/)).toBeInTheDocument();
  });

  it("montre les fonctions en cours et replie les anciennes", async () => {
    const { getByRole, queryByText } = renderWithProviders(
      <MandatsTimeline mandats={mandatsExemple} />,
    );
    expect(getByRole("list", { name: "Fonctions en cours" })).toHaveTextContent(
      "Commission des affaires sociales",
    );
    expect(queryByText("Mission d'information sur les mobilités")).not.toBeVisible();
    const bouton = getByRole("button", { name: "Anciennes fonctions (1)" });
    await userEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(queryByText("Mission d'information sur les mobilités")).toBeVisible();
  });

  it("n'indique pas la fonction pour une seule chambre", () => {
    const { getByRole } = renderWithProviders(<MandatsTimeline mandats={mandatUnique} />);
    expect(getByRole("list", { name: "Mandats" })).not.toHaveTextContent("Député ·");
  });

  it("affiche un état vide sans mandat", () => {
    const { getByText } = renderWithProviders(<MandatsTimeline mandats={[]} />);
    expect(getByText("Aucun mandat connu")).toBeInTheDocument();
  });

  it("colore le groupe d'époque comme GroupeBadge, même au format « r,g,b » de l'API", () => {
    const [premier] = mandatsExemple;
    if (!premier?.groupe) throw new Error("fixture sans groupe");
    const { getByRole } = renderWithProviders(
      <MandatsTimeline
        mandats={[{ ...premier, groupe: { ...premier.groupe, couleur: "204,36,67" } }]}
      />,
    );
    const item = getByRole("list", { name: "Mandats" }).querySelector("[role='listitem']");
    expect(item?.getAttribute("style")).toContain("--groupe-couleur: rgb(204, 36, 67)");
  });
});
