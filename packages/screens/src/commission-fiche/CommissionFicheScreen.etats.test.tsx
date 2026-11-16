import type { CommissionDetail } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CommissionFicheScreen } from "./CommissionFicheScreen.tsx";
import {
  commissionDetailExemple,
  commissionHemicycle,
  detail,
  reunionExemple,
} from "./fixtures.ts";

const SLUG = "assemblee-commission-des-jardins-partages";
const BASE = `/commissions/${SLUG}`;
const AVANT = Date.parse("2026-01-01T00:00:00.000Z");

const reunionBis = { ...reunionExemple, id: "reunion-exemple-2", uid: "RUANREXEMPLE2" };

describe("CommissionFicheScreen : états", () => {
  it("organe du Sénat inactif, sans date de début ni anciens membres", () => {
    const commission: CommissionDetail = {
      ...commissionDetailExemple,
      chambre: "senat",
      actif: false,
      dateDebut: null,
      anciensMembres: undefined,
    };
    const { getByText, getByRole, queryByText } = renderScreen(
      <CommissionFicheScreen slug={SLUG} initialData={detail(commission)} maintenant={AVANT} />,
      { pathname: BASE },
    );
    expect(getByText("Inactive")).toBeInTheDocument();
    expect(queryByText(/depuis le/)).toBeNull();
    expect(getByRole("link", { name: /data\.senat\.fr/ })).toBeInTheDocument();
    expect(queryByText(/anciens membres/)).toBeNull();
  });

  it("agenda d'une commission : prochaines réunions au pluriel", () => {
    const commission: CommissionDetail = {
      ...commissionDetailExemple,
      prochainesReunions: [reunionExemple, reunionBis],
    };
    const { getByText, getByRole } = renderScreen(
      <CommissionFicheScreen
        slug={SLUG}
        params={{ tab: "agenda" }}
        initialData={detail(commission)}
        maintenant={AVANT}
      />,
      { pathname: BASE },
    );
    expect(getByText("2 prochaines réunions")).toBeInTheDocument();
    expect(getByRole("tab", { name: /Agenda/ })).toHaveTextContent("2");
  });

  it("agenda de l'hémicycle : une prochaine séance", () => {
    const commission: CommissionDetail = {
      ...commissionHemicycle,
      prochainesReunions: [reunionExemple],
    };
    const { getByText } = renderScreen(
      <CommissionFicheScreen
        slug="assemblee-hemicycle-exemple"
        params={{ tab: "agenda" }}
        initialData={detail(commission)}
        maintenant={AVANT}
      />,
      { pathname: "/commissions/assemblee-hemicycle-exemple" },
    );
    expect(getByText("1 prochaine séance")).toBeInTheDocument();
  });

  it("hémicycle sans séance à venir", () => {
    const { getByText } = renderScreen(
      <CommissionFicheScreen
        slug="assemblee-hemicycle-exemple"
        params={{ tab: "agenda" }}
        initialData={detail(commissionHemicycle)}
        maintenant={AVANT}
      />,
      { pathname: "/commissions/assemblee-hemicycle-exemple" },
    );
    expect(getByText("Aucune séance à venir enregistrée")).toBeInTheDocument();
  });
});
