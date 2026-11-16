import type { ContexteGouvernemental, MotionDuScrutin } from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { ContexteGouvernementalBandeau, MotionCensureBandeau } from "./ContexteGouvernemental.tsx";
import { contexteGouvernementalExemple, motionAdopteeExemple } from "./fixtures.ts";

// Variantes fictives dérivées des fixtures.
const [projet] = contexteGouvernementalExemple.projets;
const [engagement] = contexteGouvernementalExemple.engagements;
if (!projet || !engagement) throw new Error("fixtures incomplètes");
const [pm, chef] = projet.signataires;
if (!pm || !chef) throw new Error("fixtures incomplètes");
const [motion] = engagement.motions;
if (!motion) throw new Error("fixtures incomplètes");

const cosignataire = (prenom: string, slug: string): typeof chef => ({
  ...chef,
  role: "cosignataire",
  intituleCourt: "Autre",
  membre: { ...chef.membre, prenom, slug },
});

describe("ContexteGouvernementalBandeau, variantes", () => {
  it("n'affiche rien sans projet ni engagement", () => {
    renderScreen(<ContexteGouvernementalBandeau contexte={{ projets: [], engagements: [] }} />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("présente un projet du Sénat signé du Premier ministre seul, sans gouvernement connu", () => {
    const contexte: ContexteGouvernemental = {
      projets: [
        {
          ...projet,
          chambreDepot: "senat",
          stade: "promulgue",
          gouvernement: null,
          signataires: [pm],
        },
      ],
      engagements: [],
    };
    renderScreen(<ContexteGouvernementalBandeau contexte={contexte} />);
    expect(screen.getByText(/Déposé au Sénat le 5 janvier 2026 par le Gouvernement/)).toBeVisible();
    expect(screen.getByText(/Signé du Premier ministre seul/)).toHaveTextContent(
      "Signé du Premier ministre seul : Camille Exemple.",
    );
    expect(screen.getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
    expect(screen.queryByText(/Recours à l’article 49/)).toBeNull();
  });

  it("énumère les cosignataires sans Premier ministre, et se tait sans chef de file", () => {
    const contexte: ContexteGouvernemental = {
      projets: [
        {
          ...projet,
          signataires: [
            chef,
            cosignataire("Bea", "bea"),
            cosignataire("Cyl", "cyl"),
            cosignataire("Dan", "dan"),
          ],
        },
        { ...projet, dossier: { uid: "DLAUTRE", titre: "Autre" }, signataires: [] },
      ],
      engagements: [],
    };
    renderScreen(<ContexteGouvernementalBandeau contexte={contexte} />);
    expect(screen.getByText(/Porté par/)).toHaveTextContent(
      "Porté par Alex Fictif (ministre · exemple), avec Bea Fictif (ministre · autre), Cyl Fictif (ministre · autre) et Dan Fictif (ministre · autre).",
    );
    expect(screen.getAllByText(/Porté par|Signé du/)).toHaveLength(1);
  });

  it("compte plusieurs 49.3, dont un sans motion ni gouvernement, et une motion adoptée", () => {
    const contexte: ContexteGouvernemental = {
      projets: [],
      engagements: [
        {
          ...engagement,
          motions: [{ ...motion, premierSignataire: null, majoriteRequise: null, adoptee: true }],
        },
        {
          ...engagement,
          dossier: { uid: "DLENGAGEMENT2", titre: "Second texte d'exemple" },
          gouvernement: null,
          texte: null,
          motions: [],
        },
      ],
    };
    renderScreen(<ContexteGouvernementalBandeau contexte={contexte} dossierUid="DLENGAGEMENT2" />);
    expect(screen.getByText("2 recours à l’article 49, alinéa 3")).toBeInTheDocument();
    expect(screen.getByText("Motion de censure")).toBeInTheDocument();
    expect(screen.getByText("adoptée, le gouvernement est renversé")).toBeInTheDocument();
    expect(screen.queryByText(/requises/)).toBeNull();
    expect(
      screen.getByText("Aucune motion de censure rattachée à cet engagement."),
    ).toBeInTheDocument();
    // Sur ce dossier mais sans texte visé : le dossier d'engagement reste cité.
    expect(screen.getByRole("link", { name: "Second texte d'exemple" })).toHaveAttribute(
      "href",
      "/dossiers/DLENGAGEMENT2",
    );
  });
});

describe("MotionCensureBandeau, variantes", () => {
  it("présente une motion spontanée rejetée, sans signataire ni majorité connus", () => {
    const spontanee: MotionDuScrutin = {
      ...motionAdopteeExemple,
      alinea: 2,
      adoptee: false,
      pour: 1500,
      premierSignataire: null,
      majoriteRequise: null,
      engagement: null,
      gouvernement: null,
    };
    renderScreen(<MotionCensureBandeau motion={spontanee} />);
    expect(
      screen.getByRole("heading", {
        name: "Motion de censure · article 49, alinéa 2 (motion spontanée)",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Contre le Gouvernement/)).toBeInTheDocument();
    expect(screen.queryByText(/que la source ne précise pas/)).toBeNull();
    expect(screen.queryByText(/Déposée par/)).toBeNull();
    expect(screen.getByText(/rejetée, le gouvernement reste en place/)).toHaveTextContent(
      /1\s500 voix pour :/u,
    );
  });

  it("signale un 49.3 que la source ne précise pas", () => {
    renderScreen(<MotionCensureBandeau motion={{ ...motionAdopteeExemple, engagement: null }} />);
    expect(screen.getByText(/que la source ne précise pas/)).toBeInTheDocument();
  });

  it("cite le 49.3 sans texte quand la source n'en donne pas", () => {
    const motionSansTexte: MotionDuScrutin = {
      ...motionAdopteeExemple,
      engagement: { date: "2026-02-01", dossierUid: "DLENGAGEMENT1", texte: null },
    };
    renderScreen(<MotionCensureBandeau motion={motionSansTexte} />);
    expect(screen.getByText(/en réponse au 49.3 du 1 février 2026\./)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Projet de loi d'exemple" })).toBeNull();
  });
});
