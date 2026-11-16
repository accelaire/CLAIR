import { ApiError } from "@clair/api-client";
import type { ListeCandidats, ResultatsCirconscription, TourResultat } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CirconscriptionScreen } from "./CirconscriptionScreen.tsx";
import {
  candidatsGironde,
  listeSortants,
  resultatsGirondeExemple,
  sortantsExemple,
} from "./fixtures.ts";

/* Données FICTIVES dérivées des fixtures de la rubrique. */

const AIN = { code: "01", nom: "Ain", nbSieges: 2 };
const GIRONDE = { code: "33", nom: "Gironde", nbSieges: 6 };
const sortantsAin = listeSortants(sortantsExemple.slice(0, 2));
const unSortant = listeSortants(sortantsExemple.slice(0, 1));
const aucunCandidat: ListeCandidats = { data: [], meta: { total: 0, candidats: 0 } };

const premierTourGironde = resultatsGirondeExemple.tours[0];
if (!premierTourGironde) throw new Error("fixture sans tour");

/** L'Ain, au scrutin majoritaire, avec ses tours. */
const resultatsAin = (
  tours: TourResultat[],
  extra: Partial<ResultatsCirconscription["circonscription"]> = {},
): ResultatsCirconscription => ({
  ...resultatsGirondeExemple,
  maintenant: "2026-09-27T18:00:00+02:00",
  circonscription: {
    ...resultatsGirondeExemple.circonscription,
    departement: "01",
    nom: "Ain",
    nbSieges: 2,
    modeScrutin: "majoritaire",
    statut: "pourvue",
    ...extra,
  },
  tours,
  repartition: null,
  sortants: [],
});

const tourMajoritaire = (tour: number): TourResultat => ({
  ...premierTourGironde,
  tour,
  lignes: [
    {
      sourceUid: `t${tour}`,
      libelle: "Hervé Exemple",
      nuance: "LEX",
      nuanceLibelle: "Liste fictive",
      famille: "droite",
      voix: 600,
      pctInscrits: 60,
      pctExprimes: 61,
      sieges: null,
      elu: true,
      candidats: [],
    },
  ],
});

const elu = resultatsGirondeExemple.elus[0];
if (!elu) throw new Error("fixture sans élu");

describe("CirconscriptionScreen, états", () => {
  it("sortants en chargement, candidatures en erreur", async () => {
    const { getByText, findByText } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-20T12:00:00+02:00"
      />,
      {
        routes: {
          "/senatoriales/2026/sortants": () => new Promise(() => undefined),
          "/senatoriales/2026/candidats": () => {
            throw new ApiError(500, "/senatoriales/2026/candidats");
          },
        },
      },
    );
    expect(getByText("Chargement des sortants…")).toBeInTheDocument();
    expect(await findByText("Les candidatures n'ont pas pu être chargées.")).toBeInTheDocument();
  });

  it("sortants en erreur", async () => {
    const { findByText } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-20T12:00:00+02:00"
        initialData={{ candidats: aucunCandidat }}
      />,
      {
        routes: {
          "/senatoriales/2026/sortants": () => {
            throw new ApiError(500, "/senatoriales/2026/sortants");
          },
        },
      },
    );
    expect(
      await findByText("Une erreur est survenue lors du chargement des sortants."),
    ).toBeInTheDocument();
  });

  it("aucun sortant connu : bilan pas encore disponible", () => {
    const { getByText, getByRole } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-20T12:00:00+02:00"
        initialData={{ sortants: listeSortants([]), candidats: aucunCandidat }}
      />,
    );
    expect(getByRole("heading", { name: "0 sénateur sortant dans l’Ain" })).toBeInTheDocument();
    expect(getByText(/n'est pas encore disponible/)).toBeInTheDocument();
  });

  it("avant le scrutin, majoritaire : candidatures au singulier et au pluriel", () => {
    const { getByRole, getByText } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-20T12:00:00+02:00"
        initialData={{ sortants: unSortant, candidats: candidatsGironde }}
      />,
    );
    expect(getByText(/Voici le bilan de mandature du sortant\./)).toBeInTheDocument();
    expect(getByText(/1 candidature pour 2 sièges/)).toBeInTheDocument();
    expect(getByRole("heading", { name: "1 sénateur sortant dans l’Ain" })).toBeInTheDocument();
  });

  it("le jour du scrutin, avant les résultats : attente et horaires", () => {
    const { getByRole, getByText } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-27T10:00:00+02:00"
        resultats={resultatsAin([], { statut: "vote_en_cours" })}
        initialData={{ sortants: sortantsAin, candidats: candidatsGironde }}
      />,
    );
    expect(
      getByText(/sont remis en jeu aujourd'hui, dimanche 27 septembre 2026\. Voici les candidats/),
    ).toBeInTheDocument();
    expect(getByText("Vote en cours")).toBeInTheDocument();
    expect(getByText(/Mis à jour à/)).toBeInTheDocument();
    expect(getByRole("heading", { name: "Le vote est en cours jusqu'à 17h30" })).toBeVisible();
  });

  it("veille du scrutin, bureaux déjà ouverts outre-mer : jour J sans « aujourd'hui »", () => {
    const { getByText, getByRole } = renderScreen(
      <CirconscriptionScreen
        circonscription={GIRONDE}
        nbCirconscriptions={64}
        maintenant="2026-09-26T23:00:00+02:00"
        resultats={{
          ...resultatsGirondeExemple,
          maintenant: "2026-09-26T23:00:00+02:00",
          tours: [],
          circonscription: { ...resultatsGirondeExemple.circonscription, statut: "vote_en_cours" },
        }}
        initialData={{ sortants: sortantsAin, candidats: candidatsGironde }}
      />,
    );
    expect(
      getByText(/sont remis en jeu dimanche 27 septembre 2026\. Voici les listes en lice/),
    ).toBeInTheDocument();
    expect(getByRole("heading", { name: "2 candidats en Gironde" })).toBeInTheDocument();
  });

  it("majoritaire, 1er tour seul : sièges restant à pourvoir avec l'horaire du 2nd tour", () => {
    const { getByRole, getByText } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-27T13:00:00+02:00"
        resultats={resultatsAin([tourMajoritaire(1)], {
          statut: "partielle",
          horaires: {
            ...resultatsGirondeExemple.circonscription.horaires,
            ouvertureT2: "2026-09-27T15:30:00+02:00",
            clotureT2: "2026-09-27T17:30:00+02:00",
          },
        })}
        initialData={{ sortants: unSortant, candidats: candidatsGironde }}
      />,
    );
    expect(getByRole("heading", { name: "1 élu sur 2 dans l’Ain" })).toBeInTheDocument();
    expect(
      getByText(/1 siège reste à pourvoir au 2nd tour, de 15h30 à 17h30, heure de Paris/),
    ).toBeInTheDocument();
    expect(getByRole("heading", { name: "Résultats du 1er tour" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Participation au 1er tour" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Le sort du sénateur sortant" })).toBeInTheDocument();
    expect(getByText(/du sortant\.$/)).toBeInTheDocument();
  });

  it("majoritaire, deux tours : 2nd tour, rappel du 1er, deux blocs de participation", () => {
    const { getByRole, getByText } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-27T19:00:00+02:00"
        resultats={resultatsAin([tourMajoritaire(1), tourMajoritaire(2)])}
        initialData={{ sortants: sortantsAin, candidats: candidatsGironde }}
      />,
    );
    expect(getByRole("heading", { name: "Résultats du 2nd tour" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Rappel du 1er tour" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Participation au 2nd tour" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Participation au 1er tour" })).toBeInTheDocument();
    expect(getByText(/étaient remis en jeu/)).toBeInTheDocument();
    expect(getByText("Résultats connus")).toBeInTheDocument();
  });

  it("majoritaire, 2nd tour seul publié", () => {
    const { getByRole, queryByRole } = renderScreen(
      <CirconscriptionScreen
        circonscription={AIN}
        nbCirconscriptions={64}
        maintenant="2026-09-27T19:00:00+02:00"
        resultats={{ ...resultatsAin([tourMajoritaire(2)]), elus: [elu, { ...elu, nom: "Essai" }] }}
        initialData={{ sortants: sortantsAin, candidats: candidatsGironde }}
      />,
    );
    expect(getByRole("heading", { name: "Les 2 élus dans l’Ain" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Participation au 2nd tour" })).toBeInTheDocument();
    expect(queryByRole("heading", { name: "Participation au 1er tour" })).toBeNull();
  });

  it("proportionnel sans ligne ni répartition : ni liste en tête ni répartition des sièges", () => {
    const { queryByText, queryByRole, getByRole } = renderScreen(
      <CirconscriptionScreen
        circonscription={GIRONDE}
        nbCirconscriptions={64}
        maintenant={resultatsGirondeExemple.maintenant}
        resultats={{
          ...resultatsGirondeExemple,
          tours: [{ ...premierTourGironde, lignes: [] }],
          repartition: null,
        }}
        initialData={{ sortants: unSortant, candidats: candidatsGironde }}
      />,
    );
    expect(queryByText("Liste arrivée en tête")).toBeNull();
    expect(queryByRole("heading", { name: /Comment les 6 sièges/ })).toBeNull();
    expect(getByRole("heading", { name: "Résultats par liste" })).toBeInTheDocument();
  });

  it("proportionnel avec seulement un 2nd tour : aucun bloc de résultats", () => {
    const { queryByRole } = renderScreen(
      <CirconscriptionScreen
        circonscription={GIRONDE}
        nbCirconscriptions={64}
        maintenant={resultatsGirondeExemple.maintenant}
        resultats={{ ...resultatsGirondeExemple, tours: [{ ...premierTourGironde, tour: 2 }] }}
        initialData={{ sortants: unSortant, candidats: candidatsGironde }}
      />,
    );
    expect(queryByRole("heading", { name: "Résultats par liste" })).toBeNull();
  });
});
