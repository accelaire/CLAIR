import { ApiError } from "@clair/api-client";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DossierFicheScreen, ongletEffectif } from "./DossierFicheScreen.tsx";
import {
  amendementExemple,
  dossierDetailExemple,
  etapeExemple,
  page,
  scrutinExemple,
} from "./fixtures.ts";

const CHEMIN = "/dossiers/DLEXEMPLE1";

const routes = (parcours = [etapeExemple]) => ({
  [CHEMIN]: dossierDetailExemple,
  [`${CHEMIN}/chronologie`]: { data: parcours },
  [`${CHEMIN}/scrutins`]: page([scrutinExemple]),
  [`${CHEMIN}/amendements`]: page([amendementExemple]),
});

describe("DossierFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<DossierFicheScreen uid="DLEXEMPLE1" />, {
      routes: { [CHEMIN]: () => new Promise(() => {}) },
      pathname: CHEMIN,
    });
    expect(getByRole("status")).toHaveTextContent("Chargement du dossier");
  });

  it("présente le dossier, son résumé IA signalé et ouvre le parcours par défaut", async () => {
    const { getByRole, findByRole, getByText } = renderScreen(
      <DossierFicheScreen
        uid="DLEXEMPLE1"
        initialData={{ dossier: dossierDetailExemple, parcours: [etapeExemple] }}
      />,
      { routes: routes(), pathname: CHEMIN },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Proposition de loi ordinaire relative aux jardins partagés",
    );
    expect(getByText("Générée par IA, à vérifier")).toBeInTheDocument();
    expect(getByRole("link", { name: "Commission d'exemple" })).toHaveAttribute(
      "href",
      "/commissions/commission-exemple",
    );
    expect(getByRole("tab", { name: /Parcours/, selected: true })).toBeInTheDocument();
    expect(await findByRole("link", { name: /Scrutin n° 42 : Scrutin d'exemple/ })).toHaveAttribute(
      "href",
      "/scrutins/42?chambre=senat&session=2025",
    );
  });

  it("lit l'onglet dans l'URL et liste les scrutins avec leur chambre et leur session", async () => {
    const { findByRole } = renderScreen(
      <DossierFicheScreen uid="DLEXEMPLE1" params={{ tab: "scrutins" }} />,
      { routes: routes(), pathname: CHEMIN },
    );
    expect(await findByRole("tab", { name: /Scrutins/, selected: true })).toBeInTheDocument();
    expect(await findByRole("link", { name: /Scrutin d'exemple sur l'ensemble/ })).toHaveAttribute(
      "href",
      "/scrutins/42?chambre=senat&session=2025",
    );
  });

  it("change d'onglet et de filtre par l'URL", async () => {
    const { findByRole, findByLabelText, visited } = renderScreen(
      <DossierFicheScreen uid="DLEXEMPLE1" params={{ tab: "amendements" }} />,
      { routes: routes(), pathname: CHEMIN },
    );
    expect(await findByRole("heading", { name: "Amendement n° 7" })).toBeInTheDocument();
    fireEvent.change(await findByLabelText("Groupe de l'auteur"), {
      target: { value: "groupe-exemple" },
    });
    fireEvent.click(await findByRole("tab", { name: /Scrutins/ }));
    expect(visited).toEqual([
      `${CHEMIN}?tab=amendements&groupe=groupe-exemple`,
      `${CHEMIN}?tab=scrutins`,
    ]);
  });

  it("sans parcours ni amendement, ouvre les scrutins et dit quand ils manquent", async () => {
    const { findByText, queryByRole } = renderScreen(<DossierFicheScreen uid="DLEXEMPLE1" />, {
      routes: {
        ...routes([]),
        [CHEMIN]: { ...dossierDetailExemple, amendementsCount: 0, scrutins: [], scrutinsCount: 0 },
        [`${CHEMIN}/scrutins`]: page([]),
      },
      pathname: CHEMIN,
    });
    expect(await findByText("Aucun scrutin associé à ce dossier.")).toBeInTheDocument();
    expect(queryByRole("tab", { name: /Amendements/ })).toBeNull();
  });

  it("dit qu'un dossier est introuvable, et signale une autre erreur", async () => {
    const introuvable = renderScreen(<DossierFicheScreen uid="INCONNU" />, {
      routes: {},
      pathname: "/dossiers/INCONNU",
    });
    expect(await introuvable.findByText("Dossier législatif introuvable")).toBeInTheDocument();
    introuvable.unmount();

    const panne = renderScreen(<DossierFicheScreen uid="DLEXEMPLE1" />, {
      routes: { [CHEMIN]: () => Promise.reject(new ApiError(500, CHEMIN)) },
      pathname: CHEMIN,
    });
    expect(await panne.findByRole("alert")).toHaveTextContent("Le chargement a échoué");
  });

  it("choisit l'onglet par défaut selon ce que le dossier a à montrer", () => {
    expect(ongletEffectif(null, { parcours: true, amendements: true })).toBe("parcours");
    expect(ongletEffectif("parcours", { parcours: false, amendements: true })).toBe("amendements");
    expect(ongletEffectif("scrutins", { parcours: true, amendements: true })).toBe("scrutins");
  });
});
