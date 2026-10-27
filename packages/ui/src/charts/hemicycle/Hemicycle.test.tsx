import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { groupesAssembleeExemple, groupesSenatExemple } from "../fixtures.ts";
import { describeHemicycle, Hemicycle } from "./Hemicycle.tsx";

describe("Hemicycle", () => {
  it("dessine un siège par siège de l'Assemblée et nomme l'image par son titre et sa description", () => {
    const { getByRole, container } = renderWithProviders(
      <Hemicycle groupes={groupesAssembleeExemple} totalSieges={577} title="Assemblée nationale" />,
    );
    const image = getByRole("img", { name: /Assemblée nationale Répartition des 577 sièges/ });
    expect(image).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(577);
    expect(getByRole("heading", { level: 3, name: "Assemblée nationale" })).toBeInTheDocument();
  });

  it("donne sigle et nombre de sièges en texte dans la légende", () => {
    const { getByRole } = renderWithProviders(
      <Hemicycle groupes={groupesSenatExemple} totalSieges={348} title="Sénat" />,
    );
    const legende = getByRole("list", { name: "Légende : Sénat" });
    expect(legende.querySelectorAll("li")).toHaveLength(groupesSenatExemple.length);
    expect(legende).toHaveTextContent("LR130 sièges");
  });

  it("compte les sièges vacants dans la description", () => {
    const description = describeHemicycle(
      [{ id: "a", sigle: "A", nom: "Groupe A", sieges: 340 }],
      348,
    );
    expect(description).toContain("A (Groupe A) : 340 sièges");
    expect(description).toContain("8 sièges vacants");
  });

  it("met en avant les sièges d'un groupe au survol de la légende", () => {
    const { getByText, container } = renderWithProviders(
      <Hemicycle groupes={groupesSenatExemple} totalSieges={348} title="Sénat" />,
    );
    const item = getByText("LR").closest("li");
    if (!item) throw new Error("ligne de légende absente");
    fireEvent.mouseEnter(item);
    expect(item).toHaveAttribute("data-active");
    expect(container.querySelectorAll("circle[data-dimmed]")).toHaveLength(348 - 130);
    fireEvent.mouseLeave(item);
    expect(container.querySelectorAll("circle[data-dimmed]")).toHaveLength(0);
  });

  it("rend la légende en liens vers les groupes", () => {
    const { getByRole } = renderWithProviders(
      <Hemicycle
        groupes={[
          { id: "ni", sigle: "NI", nom: "Non inscrits", sieges: 4, href: "/front/groupes" },
        ]}
        title="Exemple"
      />,
    );
    expect(getByRole("link", { name: /NI.*4 sièges/ })).toHaveAttribute("href", "/front/groupes");
  });

  it("colore un groupe comme GroupeBadge, que l'API envoie « r,g,b » ou un noir par défaut", () => {
    const { container } = renderWithProviders(
      <Hemicycle
        groupes={[
          { id: "lfi", sigle: "LFI", nom: "La France insoumise", sieges: 1, couleur: "#000000" },
          { id: "soc", sigle: "SOC", nom: "Socialistes", sieges: 1, couleur: "204,36,67" },
        ]}
        title="Test"
      />,
    );
    const styles = [...container.querySelectorAll("circle")].map((c) => c.getAttribute("style"));
    expect(styles).toContain("--siege-couleur: var(--clair-groupe-lfi, var(--clair-groupe-ni));");
    expect(styles).toContain("--siege-couleur: rgb(204, 36, 67);");
  });
});
