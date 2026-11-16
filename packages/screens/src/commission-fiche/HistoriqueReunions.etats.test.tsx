import { ApiError } from "@clair/api-client";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { pageReunions } from "./fixtures.ts";
import { HistoriqueReunions } from "./HistoriqueReunions.tsx";
import { commissionFicheParamsOf, parseCommissionFicheParams } from "./params.ts";

const SLUG = "commission-exemple";
const CHEMIN = `/commissions/${SLUG}/reunions`;
const maintenant = new Date("2026-12-01T00:00:00.000Z");
const hrefFor = (page: number) => `/commissions/${SLUG}?tab=historique&page=${page}`;

describe("HistoriqueReunions : états", () => {
  it("signale une erreur pour les séances de l'hémicycle", async () => {
    const { findByText } = renderScreen(
      <HistoriqueReunions slug={SLUG} page={1} hrefFor={hrefFor} maintenant={maintenant} seances />,
      {
        routes: {
          [CHEMIN]: () => {
            throw new ApiError(500, CHEMIN);
          },
        },
      },
    );
    expect(await findByText("Les séances passées n'ont pas pu être chargées.")).toBeInTheDocument();
  });

  it("dit quand aucune réunion passée n'est enregistrée", async () => {
    const { findByText } = renderScreen(
      <HistoriqueReunions
        slug={SLUG}
        page={1}
        hrefFor={hrefFor}
        maintenant={maintenant}
        seances={false}
      />,
      { routes: { [CHEMIN]: pageReunions([], 0) } },
    );
    expect(await findByText("Aucune réunion passée enregistrée")).toBeInTheDocument();
  });

  it("écrit la page au-delà de la première dans l'URL", () => {
    const params = parseCommissionFicheParams({ tab: "historique", page: "3" });
    expect(commissionFicheParamsOf(params)).toMatchObject({ tab: "historique", page: 3 });
  });
});
