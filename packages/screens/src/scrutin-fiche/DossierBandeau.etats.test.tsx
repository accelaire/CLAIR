import type { DossierDuScrutin } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DossierBandeau } from "./DossierBandeau.tsx";
import { scrutinDetailExemple } from "./fixtures.ts";

const base = scrutinDetailExemple().dossier;
if (!base) throw new Error("fixture sans dossier");
const dossier: DossierDuScrutin = base;

describe("DossierBandeau", () => {
  it("donne loi, sources officielles et état brut d'un dossier", () => {
    const { getByText, getByRole } = renderScreen(
      <DossierBandeau
        dossier={{
          ...dossier,
          etat: "état d'exemple",
          loiNumero: "2026-1",
          urlAN: "https://an.exemple.test/d",
          urlSenat: "https://senat.exemple.test/d",
          urlLegifrance: "https://legifrance.exemple.test/d",
          _count: { scrutins: 1, amendements: 0 },
        }}
      />,
    );
    expect(getByText("état d'exemple")).toBeInTheDocument();
    expect(getByText("Loi n° 2026-1")).toBeInTheDocument();
    expect(getByText("1 scrutin")).toBeInTheDocument();
    expect(getByText(/Sources officielles/)).toBeInTheDocument();
    expect(getByRole("link", { name: /Assemblée nationale/ })).toBeInTheDocument();
    expect(getByRole("link", { name: /Sénat/ })).toBeInTheDocument();
    expect(getByRole("link", { name: /Légifrance/ })).toBeInTheDocument();
  });

  it("n'invente ni état, ni compte, ni source", () => {
    const { queryByText } = renderScreen(
      <DossierBandeau dossier={{ ...dossier, etat: null, _count: undefined }} />,
    );
    expect(queryByText(/scrutin/)).toBeNull();
    expect(queryByText(/Sources officielles/)).toBeNull();
  });
});
