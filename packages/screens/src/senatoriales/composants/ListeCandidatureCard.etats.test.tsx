import type { Candidat, ListeCandidature } from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { candidatsGironde } from "../fixtures.ts";
import { ListeCandidatureCard } from "./ListeCandidatureCard.tsx";

// Listes fictives dérivées des fixtures.
const liste = candidatsGironde.data[0] as ListeCandidature;
const candidat = (id: string, extra: Partial<Candidat>): Candidat => ({
  id,
  nom: `Nom${id}`,
  prenom: `Prénom${id}`,
  sexe: "M",
  anneeNaissance: null,
  profession: null,
  ordre: 1,
  role: "titulaire",
  sortant: false,
  personne: null,
  ...extra,
});

describe("ListeCandidatureCard", () => {
  it("présente une liste au proportionnel : rangs, liens, sortant, profession", () => {
    renderScreen(<ListeCandidatureCard liste={liste} />);
    expect(
      screen.getByRole("heading", { name: "Liste Exemple pour la Gironde" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Liste fictive")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dominique Modèle" })).toHaveAttribute(
      "href",
      "/senateurs/dominique-modele",
    );
    expect(screen.getByText("sortant")).toBeInTheDocument();
    expect(screen.getByText("Cadre · né en 1960")).toBeInTheDocument();
    expect(screen.getByText("Enseignante · née en 1985")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText(/Remplaçant/)).not.toBeInTheDocument();
  });

  it("titre un binôme majoritaire par son titulaire et liste le remplaçant", () => {
    const binome: ListeCandidature = {
      ...liste,
      modeScrutin: "majoritaire",
      libelle: null,
      nuanceLibelle: null,
      famille: null,
      candidats: [
        candidat("1", { profession: "Agricultrice", sexe: "F" }),
        candidat("2", { role: "suppleant" }),
      ],
    };
    renderScreen(<ListeCandidatureCard liste={binome} />);
    expect(screen.getByRole("heading", { name: "Prénom1 Nom1" })).toBeInTheDocument();
    expect(screen.getByText("Agricultrice")).toBeInTheDocument();
    expect(screen.getByText(/Remplaçant :/)).toHaveTextContent("Remplaçant : Prénom2 Nom2");
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("accorde « Remplaçants » au pluriel et se replie sur « Candidature »", () => {
    const sansTitulaire: ListeCandidature = {
      ...liste,
      libelle: null,
      candidats: [candidat("1", { role: "suppleant" }), candidat("2", { role: "suppleant" })],
    };
    renderScreen(<ListeCandidatureCard liste={sansTitulaire} />);
    expect(screen.getByRole("heading", { name: "Candidature" })).toBeInTheDocument();
    expect(screen.getByText(/Remplaçants :/)).toHaveTextContent(
      "Remplaçants : Prénom1 Nom1, Prénom2 Nom2",
    );
  });

  it("précise la famille « droite ou extrême droite » à côté de la nuance", () => {
    renderScreen(
      <ListeCandidatureCard liste={{ ...liste, famille: "droite_ou_extreme_droite" }} />,
    );
    expect(screen.getByText("Droite ou extrême droite")).toBeInTheDocument();
  });

  it("renvoie un ancien député vers sa fiche de l'Assemblée", () => {
    const depute: ListeCandidature = {
      ...liste,
      candidats: [
        candidat("1", {
          personne: { slug: "ancien-depute", chambre: "assemblee", photoUrl: null },
        }),
      ],
    };
    renderScreen(<ListeCandidatureCard liste={depute} />);
    expect(screen.getByRole("link", { name: "Prénom1 Nom1" })).toHaveAttribute(
      "href",
      "/deputes/ancien-depute",
    );
  });
});
