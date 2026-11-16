import type { BilanGouvernement, MotionCensure } from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { BilanCensure, BilanTextes } from "./BilanGouvernement.tsx";
import { gouvernementFictif, motionFictive, reponseFictive } from "./fixtures.ts";

// Variantes FICTIVES du bilan d'exemple.
const bilan = gouvernementFictif.bilan;
if (!bilan) throw new Error("fixture sans bilan");
const [projetArmees, ratification] = bilan.textes.liste;
if (!projetArmees || !ratification) throw new Error("fixture incomplète");
const domaines = reponseFictive().domaines ?? [];

const vide: BilanGouvernement = {
  ...bilan,
  textes: { ...bilan.textes, total: 0, portes: 0, liste: [] },
  engagements: [],
  motions: { total: 0, alinea2: 0, alinea3: 0, adoptees: 0, liste: [] },
};

const motion = (partiel: Partial<MotionCensure>): MotionCensure => ({
  ...motionFictive,
  ...partiel,
});

describe("BilanTextes", () => {
  it("dit qu'aucun projet n'a été déposé", () => {
    renderScreen(<BilanTextes bilan={vide} domaines={domaines} />);
    expect(
      screen.getByText("Aucun projet de loi déposé pendant ce gouvernement."),
    ).toBeInTheDocument();
  });

  it("range les textes par domaine, autres portefeuilles et Premier ministre seul", () => {
    const chef = projetArmees.chefDeFile;
    if (!chef) throw new Error("fixture sans chef de file");
    const textes: BilanGouvernement["textes"] = {
      ...bilan.textes,
      total: 4,
      portes: 4,
      parStadePortes: { promulgue: 1, adopte: 2, examine: 1, depose: 2 },
      liste: [
        projetArmees,
        {
          ...projetArmees,
          dossier: { uid: "D2", titre: "Texte sans domaine" },
          chefDeFile: { ...chef, domaine: null },
        },
        {
          ...projetArmees,
          dossier: { uid: "D3", titre: "Texte d'un domaine nouveau" },
          chefDeFile: { ...chef, domaine: "inconnu" },
        },
        {
          ...projetArmees,
          dossier: { uid: "D4", titre: "Texte du Premier ministre" },
          chefDeFile: null,
        },
      ],
    };
    renderScreen(<BilanTextes bilan={{ ...bilan, textes }} domaines={domaines} />);
    expect(screen.getByText(/Sur 4 textes portés/)).toHaveTextContent(
      "Sur 4 textes portés : 1 promulgué, 2 adoptés sans promulgation connue, 1 examiné sans adoption définitive, 2 jamais examinés en séance.",
    );
    expect(
      screen.getByRole("heading", { name: "Armées et anciens combattants (1)" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Autres portefeuilles (2)" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Signés du Premier ministre seul (1)" }),
    ).toBeVisible();
    expect(screen.queryByText(/Ratifications d’ordonnances/)).toBeNull();
  });

  it("ne compte que les ratifications quand aucun texte n'est porté", () => {
    renderScreen(
      <BilanTextes
        bilan={{
          ...bilan,
          textes: { ...bilan.textes, total: 1, portes: 0, liste: [ratification] },
        }}
        domaines={domaines}
      />,
    );
    expect(screen.queryByText(/Sur \d+ texte/)).toBeNull();
    expect(screen.getByText("Ratifications d’ordonnances et conventions (1)")).toBeInTheDocument();
  });

  it("écrit « examiné » au singulier pour un seul texte jamais examiné", () => {
    renderScreen(
      <BilanTextes
        bilan={{
          ...bilan,
          textes: {
            ...bilan.textes,
            parStadePortes: { promulgue: 0, adopte: 0, examine: 0, depose: 1 },
          },
        }}
        domaines={domaines}
      />,
    );
    expect(screen.getByText(/1 jamais examiné en séance/)).toBeInTheDocument();
  });
});

describe("BilanCensure", () => {
  it("dit qu'il n'y a eu ni 49.3 ni motion", () => {
    renderScreen(<BilanCensure bilan={vide} />);
    expect(
      screen.getByText("Aucun recours au 49.3 ni motion de censure pendant ce gouvernement."),
    ).toBeInTheDocument();
  });

  it("rapproche les motions sans engagement identifié et liste les motions spontanées", () => {
    const sansEngagement = motion({
      date: "2026-03-05",
      engagementDossierUid: null,
      scrutin: { numero: 2001, chambre: "assemblee", session: "17" },
    });
    const spontanee = motion({
      date: "2026-04-01",
      alinea: 2,
      engagementDossierUid: null,
      scrutin: { numero: 2002, chambre: "assemblee", session: "17" },
    });
    const avecMotions: BilanGouvernement = {
      ...bilan,
      engagements: [
        {
          date: "2026-03-01",
          dossier: { uid: "DLR-ENG-2", titre: "Engagement sur le texte deux" },
          texte: { uid: "DLR-TEXTE-2", titre: "Texte fictif deux" },
          motions: [],
        },
        {
          date: "2025-12-01",
          dossier: { uid: "DLR-ENG-3", titre: "Engagement sur le texte trois" },
          texte: null,
          motions: [],
        },
      ],
      motions: {
        total: 2,
        alinea2: 1,
        alinea3: 1,
        adoptees: 0,
        liste: [sansEngagement, spontanee],
      },
    };
    renderScreen(<BilanCensure bilan={avecMotions} />);
    expect(
      screen.getByRole("heading", { name: /Recours à l’article 49, alinéa 3 \(2\)/ }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Texte fictif deux" })).toHaveAttribute(
      "href",
      "/dossiers/DLR-TEXTE-2",
    );
    expect(
      screen.getByText(/Motions votées le 5 mars 2026, sans que la source dise/),
    ).toBeVisible();
    expect(screen.getByText("Aucune motion de censure.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Motions en réponse à un 49.3 non identifié" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Motions de censure spontanées (article 49, alinéa 2) (1)",
      }),
    ).toBeVisible();
  });

  it("présente des motions sans aucun 49.3", () => {
    renderScreen(
      <BilanCensure
        bilan={{
          ...bilan,
          engagements: [],
          motions: {
            total: 1,
            alinea2: 1,
            alinea3: 0,
            adoptees: 0,
            liste: [motion({ alinea: 2 })],
          },
        }}
      />,
    );
    expect(screen.queryByRole("heading", { name: /Recours à l’article 49/ })).toBeNull();
    expect(screen.getByRole("heading", { name: /spontanées/ })).toBeVisible();
  });
});
