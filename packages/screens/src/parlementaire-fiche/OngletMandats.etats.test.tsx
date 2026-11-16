import type {
  FonctionGouvernementale,
  FonctionParlementaire,
  MandatParlementaire,
  ParlementaireDetail,
} from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ficheExemple } from "./fixtures.ts";
import {
  mandatsDeLaFiche,
  OngletMandats,
  periodeDe,
  postesDeLaFiche,
  versFonction,
} from "./OngletMandats.tsx";

// Données FICTIVES dérivées de la fiche d'exemple.
const [mandat17] = ficheExemple.mandatsParlementaires;
const [fonction] = ficheExemple.mandats;
if (!mandat17 || !fonction) throw new Error("fixture incomplète");

const mandat16: MandatParlementaire = {
  ...mandat17,
  id: "mandat-16",
  legislature: 16,
  dateDebut: "2022-06-22T00:00:00.000Z",
  dateFin: "2024-06-09T00:00:00.000Z",
  groupe: null,
  circonscription: null,
};

const fonctionLibre: FonctionParlementaire = {
  ...fonction,
  id: "fonction-libre",
  typeOrgane: "GE",
  institution: null,
  commission: null,
  dateDebut: "2023-01-10T00:00:00.000Z",
};

describe("periodeDe", () => {
  it("nomme la législature, la mandature ou le mandat sans période", () => {
    expect(periodeDe(mandat17)).toBe("XVIIe législature");
    expect(periodeDe({ ...mandat17, chambre: "senat", legislature: null, mandature: 2023 })).toBe(
      "Mandature 2023",
    );
    expect(periodeDe({ ...mandat17, chambre: "senat", legislature: null, mandature: null })).toBe(
      "Mandat de sénateur",
    );
    expect(periodeDe({ ...mandat17, legislature: null, mandature: null })).toBe("Mandat de député");
  });
});

describe("versFonction", () => {
  it("lie une commission connue", () => {
    expect(versFonction(fonction)).toMatchObject({
      organe: "Commission des exemples",
      href: "/commissions/commission-exemple",
    });
  });

  it("prend l'institution, à défaut le type d'organe, sans lien", () => {
    expect(versFonction({ ...fonctionLibre, institution: "Groupe d'études" })).toMatchObject({
      organe: "Groupe d'études",
      href: undefined,
    });
    expect(versFonction(fonctionLibre).organe).toBe("GE");
  });
});

describe("mandatsDeLaFiche", () => {
  it("range les mandats du plus récent au plus ancien et y rattache les fonctions", () => {
    const fiche: ParlementaireDetail = {
      ...ficheExemple,
      mandatsParlementaires: [mandat16, mandat17],
      mandats: [
        fonction,
        fonctionLibre,
        { ...fonctionLibre, id: "avant", dateDebut: "2001-01-01" },
      ],
    };
    const [recent, ancien] = mandatsDeLaFiche(fiche);
    expect(recent?.id).toBe("mandat-17");
    expect(recent?.groupe).toMatchObject({ sigle: "EXE", href: "/groupes/assemblee/exemple" });
    expect(recent?.circonscription).toBe("99 - Circonscription 2 (99)");
    // Une fonction hors de tout mandat va au plus récent.
    expect(recent?.fonctions?.map((f) => f.id)).toEqual(["fonction-1", "avant"]);
    expect(ancien).toMatchObject({ groupe: null, circonscription: null });
    expect(ancien?.fonctions?.map((f) => f.id)).toEqual(["fonction-libre"]);
  });

  it("ignore les fonctions d'une fiche sans mandat", () => {
    expect(mandatsDeLaFiche({ ...ficheExemple, mandatsParlementaires: [] })).toEqual([]);
  });
});

describe("postesDeLaFiche", () => {
  const presidence: FonctionGouvernementale = {
    type: "presidence",
    uid: "PR-FICTIF",
    qualite: "Président de la République",
    intitule: "Présidence de la République",
    intituleCourt: null,
    dateDebut: "2017-05-14",
    dateFin: "2022-05-13",
    gouvernement: null,
  };

  it("garde la qualité d'une présidence, sans gouvernement ni bilan", () => {
    expect(postesDeLaFiche([presidence])).toEqual([
      {
        id: "PR-FICTIF",
        nature: "presidence",
        libelle: "Président de la République",
        dateDebut: "2017-05-14",
        dateFin: "2022-05-13",
        gouvernement: null,
        details: undefined,
      },
    ]);
  });

  it("décrit un poste ministériel et lie son gouvernement", () => {
    const [p] = postesDeLaFiche([
      {
        ...presidence,
        type: "poste_ministeriel",
        uid: "M1",
        qualite: "Ministre",
        intituleCourt: "Exemples",
        gouvernement: { uid: "G", slug: "fictif", nom: "Fictif" },
      },
    ]);
    expect(p).toMatchObject({
      nature: "gouvernement",
      libelle: "Ministre · Exemples",
      gouvernement: { nom: "Fictif", href: "/gouvernements/fictif" },
    });
  });
});

describe("OngletMandats", () => {
  it("rend la frise d'une fiche sans fonction gouvernementale ni sexe connu", () => {
    renderScreen(
      <OngletMandats
        fiche={{ ...ficheExemple, sexe: null, fonctionsGouvernementales: undefined }}
      />,
    );
    expect(screen.getByText("Mandats et fonctions")).toBeInTheDocument();
    expect(screen.queryByText(/Bilan de chaque poste calculé par CLAIR/)).toBeNull();
  });

  it("cite la provenance des bilans quand un poste en a un", () => {
    renderScreen(
      <OngletMandats
        fiche={{
          ...ficheExemple,
          sexe: "M",
          fonctionsGouvernementales: [
            {
              type: "poste_ministeriel",
              uid: "M1",
              qualite: "Ministre",
              intitule: "Ministère des exemples",
              intituleCourt: "Exemples",
              dateDebut: "2025-01-01",
              dateFin: null,
              gouvernement: null,
              bilan: {
                textes: null,
                reponses: { assemblee: 3, senat: 0 },
                premierMinistre: null,
              },
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/Bilan de chaque poste calculé par CLAIR/)).toBeInTheDocument();
    expect(screen.getByText("3 réponses en séance")).toBeInTheDocument();
  });
});
