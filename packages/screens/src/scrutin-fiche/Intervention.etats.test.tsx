import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { interventionExemple } from "./fixtures.ts";
import { Intervention, nomOrateur } from "./Intervention.tsx";

describe("Intervention", () => {
  it("nomme un orateur non relié par le compte rendu, ou le dit non identifié", () => {
    expect(nomOrateur({ ...interventionExemple, parlementaire: null })).toBe("Camille Exemple");
    expect(
      nomOrateur({
        ...interventionExemple,
        parlementaire: null,
        orateurPrenom: null,
        orateurNom: null,
      }),
    ).toBe("Orateur non identifié");
  });

  it("donne la qualité d'un orateur non relié, sans lien vers une fiche", () => {
    const { getByText, queryByRole } = renderScreen(
      <Intervention
        intervention={{
          ...interventionExemple,
          parlementaire: null,
          orateurPrenom: null,
          orateurNom: "Ministre d'exemple",
          orateurQualite: "Ministre",
        }}
        chambre="senat"
      />,
    );
    expect(getByText("Ministre d'exemple")).toBeInTheDocument();
    expect(getByText("Ministre")).toBeInTheDocument();
    expect(queryByRole("link")).toBeNull();
  });

  it("lie la fiche du sénateur, sans badge de groupe inconnu", () => {
    const parlementaire = interventionExemple.parlementaire;
    const { getByRole, queryByText } = renderScreen(
      <Intervention
        intervention={{ ...interventionExemple, parlementaire: { ...parlementaire, groupe: null } }}
        chambre="senat"
      />,
    );
    expect(getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/senateurs/camille-exemple",
    );
    expect(queryByText("GPA")).toBeNull();
  });

  it("nettoie le texte et renvoie au compte rendu d'un extrait tronqué", () => {
    const { getByRole, getByText } = renderScreen(
      <Intervention
        intervention={{
          ...interventionExemple,
          contenu: "<p>Propos&nbsp;d'exemple &amp; suite<br/>fin</p>",
          hasMore: true,
          sourceUrl: "https://compte-rendu.exemple.test/1",
        }}
        chambre="assemblee"
      />,
    );
    expect(getByText(/Propos d'exemple & suite/)).toBeInTheDocument();
    expect(
      getByRole("link", { name: /Lire l'intervention entière au compte rendu/ }),
    ).toHaveAttribute("href", "https://compte-rendu.exemple.test/1");
  });
});
