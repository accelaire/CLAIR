import { ApiError } from "@clair/api-client";
import type {
  BilanPoste,
  ComptesProjets,
  FonctionGouvernementale,
  MembreGouvernementReponse,
} from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { aUnBilan, BilanPosteLigne, resumeBilanPoste } from "./BilanPoste.tsx";

// Données FICTIVES : postes, textes et motions inventés.
const comptes = (partiel: Partial<ComptesProjets> = {}): ComptesProjets => ({
  total: 0,
  portes: 0,
  parNature: {
    ordinaire: 0,
    ratification_ordonnance: 0,
    convention: 0,
    finances: 0,
    constitutionnelle: 0,
    organique: 0,
  },
  parStadePortes: { promulgue: 0, adopte: 0, examine: 0, depose: 0 },
  ...partiel,
});

const bilanVide: BilanPoste = {
  textes: null,
  reponses: { assemblee: 0, senat: 0 },
  premierMinistre: null,
};

const bilanPM: BilanPoste = {
  textes: { chefDeFile: comptes(), cosignataire: 0 },
  reponses: { assemblee: 1, senat: 0 },
  premierMinistre: { engagements: 1, motions: 2, motionsAdoptees: 0 },
};

const poste = (partiel: Partial<FonctionGouvernementale> = {}): FonctionGouvernementale => ({
  type: "poste_ministeriel",
  uid: "PM-FICTIF",
  qualite: "Premier ministre",
  intitule: "Premier ministre",
  intituleCourt: null,
  dateDebut: "2025-10-05",
  dateFin: null,
  gouvernement: null,
  membreSlug: "alex-fictif",
  bilan: bilanPM,
  ...partiel,
});

const membre = (bilan: BilanPoste | null, uid = "PM-FICTIF"): MembreGouvernementReponse => ({
  data: { slug: "alex-fictif", postes: [{ uid, bilan }] },
});

const route = "/gouvernements/membres/alex-fictif";

describe("resumeBilanPoste", () => {
  it("ne dit rien d'un bilan vide", () => {
    expect(resumeBilanPoste(bilanVide)).toEqual([]);
    expect(
      resumeBilanPoste({ ...bilanVide, textes: { chefDeFile: comptes(), cosignataire: 0 } }),
    ).toEqual([]);
  });

  it("dit « aucun promulgué », les ratifications et les textes cosignés au singulier", () => {
    const bilan: BilanPoste = {
      ...bilanVide,
      textes: {
        chefDeFile: comptes({
          portes: 1,
          parNature: { ...comptes().parNature, convention: 1 },
        }),
        cosignataire: 1,
      },
      reponses: { assemblee: 0, senat: 1 },
    };
    expect(resumeBilanPoste(bilan)).toEqual([
      "1 texte porté, aucun promulgué",
      "1 ratification ou convention",
      "1 texte cosigné",
      "1 réponse en séance",
    ]);
  });

  it("ajoute les 49.3 et motions d'un Premier ministre", () => {
    expect(resumeBilanPoste(bilanPM)).toEqual([
      "1 réponse en séance",
      "1 recours au 49.3",
      "2 motions de censure",
    ]);
  });
});

describe("aUnBilan", () => {
  it("demande un bilan qui a quelque chose à dire", () => {
    expect(aUnBilan(poste({ bilan: null }))).toBe(false);
    expect(aUnBilan(poste({ bilan: bilanVide }))).toBe(false);
    expect(aUnBilan(poste())).toBe(true);
  });
});

describe("BilanPosteLigne", () => {
  it("ne rend rien sans bilan ou avec un bilan vide", () => {
    const { container } = renderScreen(
      <>
        <BilanPosteLigne f={poste({ bilan: null })} />
        <BilanPosteLigne f={poste({ bilan: bilanVide })} />
      </>,
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("donne le résumé sans bouton quand le membre n'a pas de page", () => {
    renderScreen(<BilanPosteLigne f={poste({ membreSlug: null })} />);
    expect(
      screen.getByText("1 réponse en séance · 1 recours au 49.3 · 2 motions de censure"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("annonce le chargement du détail", async () => {
    renderScreen(<BilanPosteLigne f={poste()} />, {
      routes: { [route]: () => new Promise(() => undefined) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voir le détail" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Chargement…");
  });

  it("dit que le détail n'a pas pu être chargé", async () => {
    renderScreen(<BilanPosteLigne f={poste()} />, {
      routes: {
        [route]: () => {
          throw new ApiError(500, route);
        },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voir le détail" }));
    expect(await screen.findByText("Le détail n'a pas pu être chargé.")).toBeInTheDocument();
  });

  it("liste les 49.3 et les motions d'un Premier ministre, sans projet signé", async () => {
    const detail: BilanPoste = {
      ...bilanPM,
      textes: null,
      premierMinistre: {
        engagements: 2,
        motions: 1,
        motionsAdoptees: 0,
        listeEngagements: [
          {
            date: "2026-02-01",
            dossier: { uid: "DLENG1", titre: "Engagement sur le texte un" },
            texte: { uid: "DLTEXTE1", titre: "Texte fictif un" },
          },
          {
            date: "2026-02-10",
            dossier: { uid: "DLENG2", titre: "Engagement sur le texte deux" },
            texte: null,
          },
        ],
        listeMotions: [
          {
            date: "2026-02-03",
            alinea: 3,
            premierSignataire: null,
            pour: 100,
            majoriteRequise: 289,
            adoptee: false,
            scrutin: { numero: 7, chambre: "assemblee", session: "17" },
            engagementDossierUid: "DLENG1",
          },
        ],
      },
    };
    renderScreen(<BilanPosteLigne f={poste()} />, { routes: { [route]: membre(detail) } });
    const bouton = screen.getByRole("button", { name: "Voir le détail" });
    fireEvent.click(bouton);
    expect(await screen.findByText("Recours au 49.3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Texte fictif un" })).toHaveAttribute(
      "href",
      "/dossiers/DLTEXTE1",
    );
    expect(screen.getByRole("link", { name: "Engagement sur le texte deux" })).toHaveAttribute(
      "href",
      "/dossiers/DLENG2",
    );
    expect(screen.getByText("Motions de censure contre son gouvernement")).toBeInTheDocument();
    expect(screen.queryByText("Aucun projet de loi signé.")).toBeNull();
    expect(screen.getByRole("button", { name: "Masquer le détail" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Masquer le détail" }));
    expect(screen.queryByText("Recours au 49.3")).toBeNull();
  });

  it("dit qu'aucun projet n'est signé quand le poste n'est pas dans la réponse", async () => {
    renderScreen(<BilanPosteLigne f={poste()} />, {
      routes: { [route]: membre(null, "AUTRE-POSTE") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voir le détail" }));
    expect(await screen.findByText("Aucun projet de loi signé.")).toBeInTheDocument();
  });
});
