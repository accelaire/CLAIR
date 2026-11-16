import type { FonctionGouvernementale, MembreGouvernementReponse } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { resumeBilanPoste } from "./BilanPoste.tsx";
import { ficheExemple } from "./fixtures.ts";
import { metaFiche } from "./meta.ts";
import { OngletMandats } from "./OngletMandats.tsx";
import { TitresFiche } from "./TitresFiche.tsx";

// Données FICTIVES : poste, gouvernement et bilan inventés.
const comptes = {
  total: 3,
  portes: 2,
  parNature: {
    ordinaire: 2,
    ratification_ordonnance: 1,
    convention: 0,
    finances: 0,
    constitutionnelle: 0,
    organique: 0,
  },
  parStadePortes: { promulgue: 1, adopte: 0, examine: 1, depose: 0 },
};

const poste: FonctionGouvernementale = {
  type: "poste_ministeriel",
  uid: "PM-FICTIF",
  qualite: "Ministre",
  intitule: "Ministère des exemples",
  intituleCourt: "Exemples",
  dateDebut: "2025-10-05",
  dateFin: null,
  gouvernement: { uid: "PO-G", slug: "fictif-ii", nom: "Fictif II" },
  membreSlug: "camille-exemple",
  bilan: {
    textes: { chefDeFile: comptes, cosignataire: 4 },
    reponses: { assemblee: 10, senat: 2 },
    premierMinistre: null,
  },
};

const membre: MembreGouvernementReponse = {
  data: {
    slug: "camille-exemple",
    postes: [
      {
        uid: "PM-FICTIF",
        bilan: {
          textes: {
            chefDeFile: comptes,
            cosignataire: 4,
            liste: [
              {
                dossier: { uid: "DLR-FICTIF", titre: "Projet de loi fictif" },
                nature: "ordinaire",
                stade: "promulgue",
                chambreDepot: "assemblee",
                dateDepot: "2025-11-01",
                loi: null,
                role: "chef_de_file",
              },
            ],
          },
          reponses: { assemblee: 10, senat: 2 },
          premierMinistre: null,
        },
      },
    ],
  },
};

const ficheMinistre = { ...ficheExemple, fonctionsGouvernementales: [poste] };

describe("fiche d'un membre du Gouvernement", () => {
  it("met la fonction au Gouvernement dans le titre de la page", () => {
    expect(metaFiche(ficheMinistre, "assemblee").title).toBe(
      "Camille Exemple, ministre (Exemples), députée — votes et activité",
    );
    expect(metaFiche(ficheMinistre, "assemblee").description).toMatch(
      /^Camille Exemple \(EXE\), ministre \(Exemples\), députée\./,
    );
  });

  it("affiche les titres sous le nom, le poste lié à son gouvernement", () => {
    const { getByRole } = renderScreen(
      <TitresFiche
        fiche={{
          ...ficheMinistre,
          mandats: [
            {
              id: "f",
              typeOrgane: "COMPER",
              institution: null,
              qualite: "Présidente",
              dateDebut: "2024-07-20T00:00:00.000Z",
              dateFin: null,
              commission: { slug: "c", nom: "Commission des exemples", chambre: "assemblee" },
            },
          ],
        }}
      />,
    );
    const liste = getByRole("list", { name: "Fonctions en cours" });
    expect(liste).toHaveTextContent("Ministre · Exemplesdepuis le 5 octobre 2025");
    expect(liste).toHaveTextContent("Présidente de la commission des exemples");
    expect(getByRole("link", { name: "Gouvernement Fictif II" })).toHaveAttribute(
      "href",
      "/gouvernements/fictif-ii",
    );
  });

  it("n'affiche rien sans fonction en vue", () => {
    const { container } = renderScreen(<TitresFiche fiche={ficheExemple} />);
    expect(container.querySelector("ul")).toBeNull();
  });

  it("résume le bilan d'un poste", () => {
    expect(
      resumeBilanPoste(
        poste.bilan ?? {
          textes: null,
          reponses: { assemblee: 0, senat: 0 },
          premierMinistre: null,
        },
      ),
    ).toEqual([
      "2 textes portés, dont 1 promulgué",
      "1 ratification ou convention",
      "4 textes cosignés",
      "12 réponses en séance",
    ]);
  });

  it("met le poste dans la frise des mandats, à sa date, avec son bilan", () => {
    const { getByRole, getByText, queryByRole } = renderScreen(
      <OngletMandats fiche={ficheMinistre} />,
    );
    expect(queryByRole("heading", { name: "Au Gouvernement" })).toBeNull();
    const entrees = getByRole("list", { name: "Mandats et fonctions" }).querySelectorAll(
      ":scope > [role='listitem']",
    );
    const poste = [...entrees].find((e) => e.getAttribute("data-poste") === "gouvernement");
    expect(poste).toHaveTextContent("Ministre · Exemples");
    expect(poste).toHaveTextContent("2 textes portés, dont 1 promulgué");
    expect(getByRole("link", { name: "Gouvernement Fictif II" })).toHaveAttribute(
      "href",
      "/gouvernements/fictif-ii",
    );
    expect(getByText(/Bilan de chaque poste calculé par CLAIR/)).toBeInTheDocument();
  });

  it("charge le détail du poste à l'ouverture", async () => {
    const { getByRole, findByRole } = renderScreen(<OngletMandats fiche={ficheMinistre} />, {
      routes: { "/gouvernements/membres/camille-exemple": membre },
    });
    const bouton = getByRole("button", { name: "Voir le détail" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bouton);
    expect(await findByRole("link", { name: "Projet de loi fictif" })).toHaveAttribute(
      "href",
      "/dossiers/DLR-FICTIF",
    );
    expect(getByRole("button", { name: "Masquer le détail" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
