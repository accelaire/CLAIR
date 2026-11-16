import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { AmendementsOnglet } from "./AmendementsOnglet.tsx";
import { scrutinDetailExemple } from "./fixtures.ts";
import { ScrutinInfos } from "./ScrutinInfos.tsx";

describe("AmendementsOnglet", () => {
  it("mène de la défense d'un amendement au débat du vote et à la séance", () => {
    const scrutin = scrutinDetailExemple({ seance: { uid: "SEANCE-EXEMPLE", rang: 2 } });
    const { getByRole } = renderScreen(
      <AmendementsOnglet scrutin={scrutin} debatHref="/scrutins/101?onglet=debats" />,
    );
    expect(getByRole("link", { name: "Lire le débat de ce vote" })).toHaveAttribute(
      "href",
      "/scrutins/101?onglet=debats",
    );
    expect(getByRole("link", { name: "Voir dans la séance" })).toHaveAttribute(
      "href",
      "/reunions/SEANCE-EXEMPLE?vote=scrutin-exemple-1&rang=2",
    );
  });

  it("n'affiche aucun lien sans débat ni séance", () => {
    const { queryByRole } = renderScreen(
      <AmendementsOnglet scrutin={scrutinDetailExemple()} debatHref={null} />,
    );
    expect(queryByRole("link", { name: "Lire le débat de ce vote" })).toBeNull();
    expect(queryByRole("link", { name: "Voir dans la séance" })).toBeNull();
  });
});

describe("ScrutinInfos", () => {
  it("lie le groupe et l'élu cités dans « Vote demandé par »", async () => {
    // Groupe et élus fictifs ; le groupe vient de `/groupes` de la législature du scrutin.
    const scrutin = scrutinDetailExemple({
      demandeurTexte: 'M. Alex Fictif et les membres du groupe "Groupe parlementaire d\'exemple"',
    });
    const { findByRole, getByRole } = renderScreen(<ScrutinInfos scrutin={scrutin} />, {
      routes: {
        "/groupes": (query: Record<string, unknown>) =>
          query.legislature === "17"
            ? {
                data: [
                  {
                    slug: "gpa",
                    chambre: "assemblee",
                    nom: "GPA",
                    nomComplet: "Groupe parlementaire d'exemple",
                  },
                ],
              }
            : { data: [] },
      },
    });
    expect(await findByRole("link", { name: "Groupe parlementaire d'exemple" })).toHaveAttribute(
      "href",
      "/groupes/assemblee/gpa?legislature=17",
    );
    expect(getByRole("link", { name: "Alex Fictif" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/deputes\//),
    );
  });
});
