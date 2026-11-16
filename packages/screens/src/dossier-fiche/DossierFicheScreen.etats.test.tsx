import { ApiError } from "@clair/api-client";
import type { DossierDetail } from "@clair/data";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DossierFicheScreen } from "./DossierFicheScreen.tsx";
import {
  amendementExemple,
  dossierDetailExemple,
  etapeExemple,
  page,
  scrutinExemple,
} from "./fixtures.ts";

const CHEMIN = "/dossiers/DLEXEMPLE1";

const routes = (dossier: DossierDetail = dossierDetailExemple) => ({
  [CHEMIN]: dossier,
  [`${CHEMIN}/chronologie`]: { data: [etapeExemple] },
  [`${CHEMIN}/scrutins`]: page([scrutinExemple]),
  [`${CHEMIN}/amendements`]: page([amendementExemple]),
});

describe("DossierFicheScreen : états", () => {
  it("en-tête minimal : état brut, sans procédure, date ni source", async () => {
    const dossier: DossierDetail = {
      ...dossierDetailExemple,
      etat: "etat_inconnu_exemple",
      procedureLibelle: null,
      dateDepot: null,
      urlAN: null,
      urlSenat: null,
    };
    const { findByRole, getByText, queryByText } = renderScreen(
      <DossierFicheScreen uid="DLEXEMPLE1" />,
      { routes: routes(dossier), pathname: CHEMIN },
    );
    expect(await findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(getByText("etat_inconnu_exemple")).toBeInTheDocument();
    expect(queryByText(/Déposé le/)).toBeNull();
    expect(queryByText(/Sources officielles/)).toBeNull();
  });

  it("deux sources officielles et lien vers le sujet", async () => {
    const dossier: DossierDetail = {
      ...dossierDetailExemple,
      etat: null,
      urlSenat: "https://www.senat.fr/exemple",
      sujet: { slug: "sujet-exemple", label: "Sujet d'exemple", status: "en_cours" },
    };
    const { findByRole, getByText } = renderScreen(<DossierFicheScreen uid="DLEXEMPLE1" />, {
      routes: routes(dossier),
      pathname: CHEMIN,
    });
    expect(await findByRole("link", { name: /Voir l'analyse complète du sujet/ })).toHaveAttribute(
      "href",
      "/sujets/sujet-exemple",
    );
    expect(getByText(/Sources officielles/)).toHaveTextContent(/Assemblée nationale.*, .*Sénat/);
  });

  it("parcours en chargement : onglet ouvert sur son attente", async () => {
    const { getAllByRole } = renderScreen(<DossierFicheScreen uid="DLEXEMPLE1" />, {
      routes: { ...routes(), [`${CHEMIN}/chronologie`]: () => new Promise(() => undefined) },
      pathname: CHEMIN,
    });
    await waitFor(() =>
      expect(
        getAllByRole("status").some((s) => s.textContent?.includes("Chargement du parcours")),
      ).toBe(true),
    );
  });

  it("parcours en erreur et onglet amendements demandé sans amendement : scrutins", async () => {
    const { findByRole, queryByRole } = renderScreen(
      <DossierFicheScreen uid="DLEXEMPLE1" params={{ tab: "amendements" }} />,
      {
        routes: {
          ...routes({ ...dossierDetailExemple, amendementsCount: 0 }),
          [`${CHEMIN}/chronologie`]: () => {
            throw new ApiError(500, `${CHEMIN}/chronologie`);
          },
        },
        pathname: CHEMIN,
      },
    );
    expect(await findByRole("tab", { name: /Scrutins/, selected: true })).toBeInTheDocument();
    expect(queryByRole("tab", { name: /Parcours/ })).toBeNull();
  });

  it("un amendement demandé ouvre son onglet, même sans amendement compté", async () => {
    const { findByRole } = renderScreen(
      <DossierFicheScreen uid="DLEXEMPLE1" params={{ amendement: "AMEXEMPLE1" }} />,
      {
        routes: routes({ ...dossierDetailExemple, amendementsCount: 0 }),
        pathname: CHEMIN,
      },
    );
    expect(await findByRole("tab", { name: /Amendements/, selected: true })).toBeInTheDocument();
    expect(await findByRole("region", { name: "L'amendement demandé" })).toBeInTheDocument();
  });
});
