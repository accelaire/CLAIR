import type { ParlementaireDetail } from "@clair/data";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { FicheEnTete } from "./FicheEnTete.tsx";
import { FicheResumeIA } from "./FicheResumeIA.tsx";
import { ficheExemple } from "./fixtures.ts";
import { TitresFiche } from "./TitresFiche.tsx";

// Variantes FICTIVES de la fiche d'exemple.
const senateur: ParlementaireDetail = {
  ...ficheExemple,
  chambre: "senat",
  sexe: "M",
  actif: false,
  serie: "2",
  circonscription: {
    id: "c",
    departement: "99",
    numero: 0,
    nom: "Exemple-sur-Mer",
    type: "senatoriale",
  },
  profession: "",
  lieuNaissance: null,
  commissionPermanente: "Commission des exemples",
  email: null,
  twitter: "@alexfictif",
  facebook: "https://facebook.example/alex",
  siteWeb: "https://alex.example",
};

describe("FicheEnTete", () => {
  it("présente un ancien sénateur, son dernier groupe, sa série et ses contacts", () => {
    renderScreen(<FicheEnTete fiche={senateur} chambre="senat" />);
    expect(screen.getByRole("heading", { level: 1, name: "Camille Exemple" })).toBeVisible();
    expect(screen.getByText("Mandat terminé")).toBeInTheDocument();
    expect(screen.getByText("Dernier groupe :")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Groupe Exemple" })).toHaveAttribute(
      "href",
      "/groupes/senat/exemple",
    );
    expect(screen.getByText("Exemple-sur-Mer (99)")).toBeInTheDocument();
    expect(screen.getByText("Série 2")).toBeInTheDocument();
    expect(screen.getByText("Né le 1 janvier 1980")).toBeInTheDocument();
    expect(screen.getByText("Commission des exemples")).toBeInTheDocument();
    const contacts = within(screen.getByRole("list", { name: "Contacts" }));
    expect(contacts.queryByRole("link", { name: /Courriel/ })).toBeNull();
    expect(contacts.getByRole("link", { name: /X \(Twitter\)/ })).toHaveAttribute(
      "href",
      "https://x.com/alexfictif",
    );
    expect(contacts.getByRole("link", { name: /Facebook/ })).toBeInTheDocument();
    expect(contacts.getByRole("link", { name: /Site web/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Comparer avec d'autres sénateurs/ })).toHaveAttribute(
      "href",
      "/senateurs?compare=camille-exemple",
    );
  });

  it("dit « 1re circonscription » et omet détails, contacts et groupe absents", () => {
    renderScreen(
      <FicheEnTete
        fiche={{
          ...ficheExemple,
          circonscription: ficheExemple.circonscription
            ? { ...ficheExemple.circonscription, numero: 1 }
            : null,
          groupe: null,
          profession: null,
          dateNaissance: null,
          email: null,
        }}
        chambre="assemblee"
      />,
    );
    expect(screen.getByText("1re circonscription (99)")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Contacts" })).toBeNull();
    expect(screen.queryByText("Mandat terminé")).toBeNull();
  });

  it("n'a ni détail ni circonscription pour une fiche dépouillée", () => {
    renderScreen(
      <FicheEnTete
        fiche={{
          ...ficheExemple,
          circonscription: null,
          profession: null,
          dateNaissance: null,
          commissionPermanente: null,
          email: null,
        }}
        chambre="assemblee"
      />,
    );
    expect(screen.queryByText(/circonscription/)).toBeNull();
    expect(screen.queryByText(/Née le/)).toBeNull();
  });
});

describe("FicheResumeIA", () => {
  it("ne rend rien sans résumé", () => {
    const { container } = renderScreen(
      <FicheResumeIA
        resumeIA={null}
        parcoursIA="Parcours fictif"
        positionsClesIA={null}
        faitsNotablesIA={null}
        iaGeneratedAt={null}
      />,
    );
    expect(container.querySelector("section")).toBeNull();
  });

  it("présente tous les blocs, sans date de mise à jour", () => {
    renderScreen(
      <FicheResumeIA
        resumeIA="Résumé fictif"
        parcoursIA="Parcours fictif"
        positionsClesIA="Positions fictives"
        faitsNotablesIA="Faits fictifs"
        iaGeneratedAt={null}
      />,
    );
    expect(screen.getByText("Positions clés")).toBeInTheDocument();
    expect(screen.getByText("Faits fictifs")).toBeInTheDocument();
    expect(screen.queryByText(/Mise à jour le/)).toBeNull();
  });
});

describe("TitresFiche", () => {
  it("ne rend rien sans fonction en cours, même sans liste de fonctions", () => {
    const { container } = renderScreen(
      <TitresFiche fiche={{ fonctionsGouvernementales: [], sexe: "F", mandats: [] }} />,
    );
    expect(container.querySelector("ul")).toBeNull();
  });

  it("lie le gouvernement d'un poste en cours et date les fonctions", () => {
    renderScreen(
      <TitresFiche
        fiche={{
          sexe: "F",
          mandats: [
            {
              id: "f",
              typeOrgane: "GP",
              institution: "Groupe Exemple",
              qualite: "Présidente",
              dateDebut: "2024-07-01T00:00:00.000Z",
              dateFin: null,
              commission: null,
            },
          ],
          fonctionsGouvernementales: [
            {
              type: "poste_ministeriel",
              uid: "p",
              qualite: "Ministre",
              intitule: "Ministère des exemples",
              intituleCourt: "Exemples",
              dateDebut: "2025-01-01",
              dateFin: null,
              gouvernement: { uid: "g", slug: "fictif", nom: "Fictif" },
            },
          ],
        }}
      />,
    );
    const titres = within(screen.getByRole("list", { name: "Fonctions en cours" }));
    expect(titres.getByText("Ministre · Exemples")).toBeInTheDocument();
    expect(titres.getByRole("link", { name: "Gouvernement Fictif" })).toHaveAttribute(
      "href",
      "/gouvernements/fictif",
    );
    expect(titres.getByText("Présidente du groupe Exemple")).toBeInTheDocument();
    expect(titres.getByText("depuis le 1 juillet 2024")).toBeInTheDocument();
  });
});
