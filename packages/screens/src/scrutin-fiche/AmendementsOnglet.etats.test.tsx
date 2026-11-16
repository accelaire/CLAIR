import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { AmendementsOnglet } from "./AmendementsOnglet.tsx";
import { scrutinDetailExemple } from "./fixtures.ts";

const [amendement] = scrutinDetailExemple().amendements;
if (!amendement) throw new Error("fixture sans amendement");

describe("AmendementsOnglet, cas limites", () => {
  it("n'offre aucun lien de dossier quand ni l'amendement ni le scrutin n'en ont", () => {
    const { queryByRole, queryByText } = renderScreen(
      <AmendementsOnglet
        scrutin={scrutinDetailExemple({
          dossier: null,
          amendements: [{ ...amendement, dossier: null, defense: null }],
        })}
      />,
    );
    expect(queryByRole("link", { name: /Voir l'amendement dans son dossier/ })).toBeNull();
    expect(queryByText("Défendu en séance")).toBeNull();
  });

  it("prend le dossier du scrutin et lie le sous-amendement à son parent", () => {
    const { getByRole } = renderScreen(
      <AmendementsOnglet
        scrutin={scrutinDetailExemple({
          amendements: [
            {
              ...amendement,
              dossier: null,
              amendementParent: {
                id: "amendement-parent",
                uid: "AMDT-PARENT",
                numero: "3",
                auteurLibelle: null,
              },
            },
          ],
        })}
        debatHref="/scrutins/101?onglet=debats"
      />,
    );
    expect(getByRole("link", { name: /Voir l'amendement dans son dossier/ })).toHaveAttribute(
      "href",
      expect.stringContaining("DOSSIER-EXEMPLE"),
    );
    expect(getByRole("link", { name: "Lire le débat de ce vote" })).toBeInTheDocument();
  });
});
