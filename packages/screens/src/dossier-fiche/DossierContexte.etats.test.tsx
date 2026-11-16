import type { DossierDetail } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DossierContexte } from "./DossierContexte.tsx";
import { dossierDetailExemple } from "./fixtures.ts";

const rapport: DossierDetail = {
  ...dossierDetailExemple,
  commissions: [
    {
      slug: "commission-exemple-2",
      nom: "Commission d'exemple pour avis",
      chambre: "senat",
      type: "permanente",
      role: "avis",
    },
  ],
  resumeIA: null,
  scrutinsCount: 3,
  amendementsCount: 2,
  stats: { totalAdopte: 2, totalRejete: 3 },
  loiNumero: "2026-12",
  loiTitre: null,
  loiAppliquee: {
    uid: "DLLOI1",
    titre: "Loi d'exemple appliquée",
    loiNumero: "2025-1",
    sujetSlug: null,
  },
  travauxApplication: [
    {
      uid: "RAPPORT1",
      titre: "Rapport d'application d'exemple",
      procedureLibelle: "Rapport",
      chambre: "senat",
      urlAN: null,
      urlSenat: null,
    },
    {
      uid: "RAPPORT2",
      titre: "Mission d'exemple",
      procedureLibelle: null,
      chambre: "assemblee",
      urlAN: null,
      urlSenat: null,
    },
  ],
};

describe("DossierContexte : états", () => {
  it("commission pour avis, chiffres au pluriel, loi, loi appliquée et travaux", () => {
    const { getByText, getByRole, queryByRole } = renderScreen(
      <DossierContexte dossier={rapport} />,
    );
    expect(getByText("Pour avis")).toBeInTheDocument();
    expect(queryByRole("heading", { name: "En clair" })).toBeNull();
    expect(getByText("Scrutins")).toBeInTheDocument();
    expect(getByText("Scrutins adoptés")).toBeInTheDocument();
    expect(getByText("Scrutins rejetés")).toBeInTheDocument();
    expect(getByText("Amendements")).toBeInTheDocument();
    expect(getByRole("heading", { name: "Loi n° 2026-12" })).toBeInTheDocument();
    expect(getByText("Porte sur la loi n° 2025-1")).toBeInTheDocument();
    expect(getByRole("link", { name: /Loi d'exemple appliquée/ })).toHaveAttribute(
      "href",
      "/dossiers/DLLOI1",
    );
    expect(getByRole("heading", { name: "Travaux d'application (2)" })).toBeInTheDocument();
    expect(getByText("Rapport")).toBeInTheDocument();
  });

  it("sans commission, loi au titre officiel, loi appliquée sans numéro", () => {
    const { getByText, queryByRole } = renderScreen(
      <DossierContexte
        dossier={{
          ...rapport,
          commissions: [],
          loiTitre: "relative aux jardins (exemple)",
          loiAppliquee: {
            uid: "DLLOI1",
            titre: "Loi d'exemple appliquée",
            loiNumero: null,
            sujetSlug: null,
          },
          travauxApplication: [],
          stats: { totalAdopte: 0, totalRejete: 1 },
        }}
      />,
    );
    expect(queryByRole("heading", { name: "Commissions saisies" })).toBeNull();
    expect(getByText("Loi relative aux jardins (exemple)")).toBeInTheDocument();
    expect(getByText("Porte sur la loi")).toBeInTheDocument();
    expect(getByText("Scrutin adopté")).toBeInTheDocument();
    expect(queryByRole("heading", { name: /Travaux d'application/ })).toBeNull();
  });
});
