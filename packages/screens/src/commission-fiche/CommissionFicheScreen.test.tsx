import { ApiError } from "@clair/api-client";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CommissionFicheScreen } from "./CommissionFicheScreen.tsx";
import {
  commissionDetailExemple,
  commissionHemicycle,
  detail,
  dossierCommissionExemple,
  pageDossiersCommission,
  pageReunions,
  reunionExemple,
} from "./fixtures.ts";

const SLUG = "assemblee-commission-des-jardins-partages";
const BASE = `/commissions/${SLUG}`;

const routes = (overrides: Record<string, unknown> = {}) => ({
  [BASE]: detail(commissionDetailExemple),
  [`${BASE}/reunions`]: pageReunions([reunionExemple], 2),
  [`${BASE}/dossiers`]: pageDossiersCommission([dossierCommissionExemple]),
  ...overrides,
});

describe("CommissionFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<CommissionFicheScreen slug={SLUG} />, {
      routes: { [BASE]: () => new Promise(() => {}) },
      pathname: BASE,
    });
    expect(getByRole("status")).toHaveTextContent("Chargement de la commission");
  });

  it("affiche l'en-tête et les membres, présidence en tête", () => {
    const { getByRole, getAllByRole } = renderScreen(
      <CommissionFicheScreen slug={SLUG} initialData={detail(commissionDetailExemple)} />,
      { routes: routes(), pathname: BASE },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Commission des jardins partagés");
    for (const lien of getAllByRole("link", { name: "Camille Fictive" })) {
      expect(lien).toHaveAttribute("href", "/deputes/camille-fictive");
    }
    const panneau = getByRole("tabpanel");
    const cartes = within(panneau).getAllByRole("heading", { level: 3 });
    expect(cartes[0]).toHaveTextContent("Camille Fictive");
    expect(getAllByRole("tab")).toHaveLength(4);
  });

  it("n'affiche qu'une fois un membre qui a plusieurs qualités", () => {
    const camille = commissionDetailExemple.membres[1];
    const avecDoublon = {
      ...commissionDetailExemple,
      membres: [
        ...commissionDetailExemple.membres,
        ...(camille ? [{ ...camille, qualite: "Membre" }] : []),
      ],
    };
    const { getByRole } = renderScreen(
      <CommissionFicheScreen slug={SLUG} initialData={detail(avecDoublon)} />,
      { routes: routes(), pathname: BASE },
    );
    const cartes = within(getByRole("tabpanel")).getAllByRole("heading", { level: 3 });
    expect(cartes).toHaveLength(2);
    expect(cartes[0]).toHaveTextContent("Camille Fictive");
    expect(cartes[1]).toHaveTextContent("Dominique Exemple");
    expect(getByRole("tab", { name: /Membres/ })).toHaveTextContent("2");
  });

  it("déplie les anciens membres", () => {
    const { getByRole, queryByRole } = renderScreen(
      <CommissionFicheScreen slug={SLUG} initialData={detail(commissionDetailExemple)} />,
      { routes: routes(), pathname: BASE },
    );
    expect(queryByRole("link", { name: /Alex Ancien/ })).not.toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /anciens membres/ }));
    expect(getByRole("link", { name: /Alex Ancien/ })).toBeInTheDocument();
  });

  it("écrit l'onglet dans l'URL", () => {
    const { getByRole, visited } = renderScreen(
      <CommissionFicheScreen slug={SLUG} initialData={detail(commissionDetailExemple)} />,
      { routes: routes(), pathname: BASE },
    );
    fireEvent.click(getByRole("tab", { name: /Historique/ }));
    expect(visited).toEqual([`${BASE}?tab=historique`]);
  });

  it("liste les réunions passées avec leur ordre du jour et une pagination en liens", async () => {
    const { findByRole, getByRole, getByText } = renderScreen(
      <CommissionFicheScreen
        slug={SLUG}
        params={{ tab: "historique" }}
        initialData={detail(commissionDetailExemple)}
      />,
      { routes: routes(), pathname: BASE },
    );
    expect(await findByRole("link", { name: /mardi 3 mars 2026/ })).toHaveAttribute(
      "href",
      "/reunions/RUANREXEMPLE1",
    );
    expect(getByText("Audition d'une personne fictive")).toBeInTheDocument();
    expect(getByRole("link", { name: /Compte rendu/ })).toHaveAttribute(
      "href",
      "https://www.assemblee-nationale.fr/dyn/docs/CRCANREXEMPLE.html",
    );
    fireEvent.click(getByRole("button", { name: /Voir l'autre point/ }));
    expect(getByText("Questions diverses")).toBeInTheDocument();
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      `${BASE}?tab=historique&page=2`,
    );
  });

  it("filtre les textes saisis dans l'URL", async () => {
    const { findByRole, getByLabelText, visited } = renderScreen(
      <CommissionFicheScreen
        slug={SLUG}
        params={{ tab: "dossiers" }}
        initialData={detail(commissionDetailExemple)}
      />,
      { routes: routes(), pathname: BASE },
    );
    expect(await findByRole("link", { name: /potagers/ })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE9",
    );
    fireEvent.change(getByLabelText("Rôle de la commission"), { target: { value: "avis" } });
    expect(visited).toEqual([`${BASE}?tab=dossiers&role=avis`]);
  });

  it("montre un état vide sans prochaine réunion", () => {
    const { getByText } = renderScreen(
      <CommissionFicheScreen
        slug={SLUG}
        params={{ tab: "agenda" }}
        initialData={detail(commissionDetailExemple)}
      />,
      { routes: routes(), pathname: BASE },
    );
    expect(getByText("Aucune réunion à venir enregistrée")).toBeInTheDocument();
  });

  it("n'a que des séances pour l'hémicycle", () => {
    const { getAllByRole } = renderScreen(
      <CommissionFicheScreen slug={SLUG} initialData={detail(commissionHemicycle)} />,
      { routes: routes(), pathname: BASE },
    );
    expect(getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Prochaines séances",
      expect.stringContaining("Séances passées"),
    ]);
  });

  it("dit qu'une commission est introuvable", async () => {
    const { findByText } = renderScreen(<CommissionFicheScreen slug="inconnue" />, {
      routes: { "/commissions/inconnue": () => Promise.reject(new ApiError(404, "x")) },
      pathname: "/commissions/inconnue",
    });
    expect(await findByText("Commission introuvable")).toBeInTheDocument();
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<CommissionFicheScreen slug={SLUG} />, {
      routes: { [BASE]: () => Promise.reject(new Error("panne")) },
      pathname: BASE,
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
