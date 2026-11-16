import type {
  CandidatResultat,
  Elu,
  LigneResultat,
  ResultatsCirconscription,
  TourResultat,
} from "@clair/data";
import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { resultatsGirondeExemple } from "../fixtures.ts";
import {
  AttenteResultats,
  BlocParticipation,
  CarteElus,
  ListeEnTete,
  ListesEtCandidats,
  RepartitionSieges,
  ResultatsParListe,
  TourMajoritaire,
} from "./BlocsCirconscription.tsx";

/* Données FICTIVES, dérivées des fixtures de la rubrique. */

const candidat = (extra: Partial<CandidatResultat> = {}): CandidatResultat => ({
  nom: "Exemple",
  prenom: "Alex",
  sexe: "M",
  anneeNaissance: 1970,
  profession: "Cadre",
  ordre: 1,
  role: "titulaire",
  sortant: false,
  elu: false,
  personne: null,
  ...extra,
});

const ligne = (extra: Partial<LigneResultat> = {}): LigneResultat => ({
  sourceUid: "l1",
  libelle: "Liste Exemple",
  nuance: "LEX",
  nuanceLibelle: "Liste fictive",
  famille: "centre",
  voix: 1000,
  pctInscrits: 40,
  pctExprimes: 50,
  sieges: 2,
  elu: true,
  candidats: [],
  ...extra,
});

const tour = (extra: Partial<TourResultat> = {}): TourResultat => ({
  tour: 1,
  publieA: "2026-09-27T12:10:00+02:00",
  verifieA: "2026-09-27T12:11:00+02:00",
  sourceUrl: "https://exemple.invalid/resultats/01",
  participation: {
    inscrits: 1000,
    abstentions: 10,
    votants: 990,
    blancs: 5,
    nuls: 5,
    exprimes: 980,
  },
  lignes: [],
  ...extra,
});

const elu = (extra: Partial<Elu> = {}): Elu => ({
  nom: "Modèle",
  prenom: "Dominique",
  sexe: "M",
  anneeNaissance: 1960,
  profession: "Cadre",
  tour: 1,
  liste: "Liste Exemple",
  nuance: "LEX",
  nuanceLibelle: "Liste fictive",
  famille: "centre",
  parcours: "nouveau",
  personne: null,
  avant: null,
  slug: null,
  mandatsLocaux: null,
  ...extra,
});

describe("ListeEnTete", () => {
  it("sans tête de liste ni siège : seulement le score, la famille à défaut de nuance", () => {
    const { getByRole, getByText, queryByText } = renderScreen(
      <ListeEnTete
        ligne={ligne({ nuanceLibelle: null, famille: "gauche", sieges: null })}
        nbSieges={3}
        autres={[]}
      />,
    );
    expect(getByRole("heading", { name: "Liste Exemple" })).toBeInTheDocument();
    expect(getByText("Gauche")).toBeInTheDocument();
    expect(queryByText(/menée par/)).toBeNull();
    expect(queryByText(/sur 3/)).toBeNull();
  });

  it("tête de liste sans fiche, en texte ; les autres listes élues séparées par des virgules", () => {
    const { getByText, queryByRole } = renderScreen(
      <ListeEnTete
        ligne={ligne({ sieges: 1, candidats: [candidat({ prenom: "Alix", nom: "Essai" })] })}
        nbSieges={3}
        autres={[
          ligne({ sourceUid: "l2", libelle: "Liste Témoin", sieges: 1 }),
          ligne({ sourceUid: "l3", libelle: "Liste Modèle", sieges: null }),
        ]}
      />,
    );
    expect(getByText(/menée par Alix Essai/)).toBeInTheDocument();
    expect(queryByRole("link")).toBeNull();
    expect(getByText("1 siège sur 3")).toBeInTheDocument();
    const mention = getByText("Liste Modèle").closest("p");
    expect(mention).toHaveTextContent("Liste Témoin 1 siège, Liste Modèle 0 siège.");
  });
});

describe("CarteElus", () => {
  it("une seule élue, sans fiche : titre au féminin, élue au 2nd tour, mandat local", () => {
    const { getByRole, getByText } = renderScreen(
      <CarteElus
        elus={[
          elu({
            sexe: "F",
            prenom: "Camille",
            nom: "Fictif",
            tour: 2,
            liste: null,
            nuanceLibelle: null,
            famille: "droite",
            mandatsLocaux: {
              source: "2026-09-01",
              mandats: [{ type: "maire", libelle: "Maire d'Exempleville", depuis: null }],
            },
          }),
        ]}
        ou="dans l'Ain"
        nbSieges={1}
        resteAPourvoir={0}
      />,
    );
    expect(getByRole("heading", { name: "L'élue dans l'Ain" })).toBeInTheDocument();
    expect(getByText("Camille Fictif")).toBeInTheDocument();
    expect(getByText("nouvelle au Parlement")).toBeInTheDocument();
    expect(getByText("Droite · élue au 2nd tour")).toBeInTheDocument();
    expect(getByText("Maire d'Exempleville")).toBeInTheDocument();
  });

  it("un seul élu masculin : « L'élu »", () => {
    const { getByRole } = renderScreen(
      <CarteElus elus={[elu()]} ou="dans l'Ain" nbSieges={1} resteAPourvoir={0} />,
    );
    expect(getByRole("heading", { name: "L'élu dans l'Ain" })).toBeInTheDocument();
  });

  it("résultats partiels : élus sur le total, fiche provisoire, sièges restants et horaire", () => {
    const { getByRole, getByText } = renderScreen(
      <CarteElus
        elus={[elu({ slug: "dominique-modele-2026", tour: 2 })]}
        ou="dans l'Ain"
        nbSieges={3}
        resteAPourvoir={2}
        horaireSecondTour="de 15h30 à 17h30, heure de Paris"
      />,
    );
    expect(getByRole("heading", { name: "1 élu sur 3 dans l'Ain" })).toBeInTheDocument();
    expect(getByText(/Chaque nom mène à sa fiche/)).toBeInTheDocument();
    expect(getByRole("link", { name: "Dominique Modèle" })).toHaveAttribute(
      "href",
      "/senateurs/dominique-modele-2026",
    );
    expect(getByText("Liste Exemple · Liste fictive · élu au 2nd tour")).toBeInTheDocument();
    expect(
      getByText(/2 sièges restent à pourvoir au 2nd tour, de 15h30 à 17h30, heure de Paris\./),
    ).toBeInTheDocument();
  });

  it("un siège restant, sans horaire connu", () => {
    const { getByText } = renderScreen(
      <CarteElus
        elus={[elu(), elu({ prenom: "Alix", nom: "Essai" })]}
        ou="dans l'Ain"
        nbSieges={3}
        resteAPourvoir={1}
      />,
    );
    expect(getByText("1 siège reste à pourvoir au 2nd tour.")).toBeInTheDocument();
  });

  it("plusieurs élus, tous connus : « Les 2 élus »", () => {
    const { getByRole } = renderScreen(
      <CarteElus
        elus={[
          elu({
            parcours: "reelu",
            personne: { slug: "a", chambre: "senat", actif: true, photoUrl: null },
          }),
          elu({ prenom: "Alix", nom: "Essai" }),
        ]}
        ou="dans l'Ain"
        nbSieges={2}
        resteAPourvoir={0}
      />,
    );
    expect(getByRole("heading", { name: "Les 2 élus dans l'Ain" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Dominique Modèle" })).toHaveAttribute("href", "/senateurs/a");
  });
});

describe("ResultatsParListe", () => {
  it("liste sans siège ni pourcentage : tirets", () => {
    const { getByRole } = renderScreen(
      <ResultatsParListe
        tour={tour({
          lignes: [
            ligne({ sieges: 1 }),
            ligne({
              sourceUid: "l2",
              libelle: "Liste Témoin",
              nuanceLibelle: null,
              famille: null,
              sieges: null,
              pctExprimes: null,
            }),
          ],
        })}
        nbSieges={1}
      />,
    );
    expect(getByRole("heading", { name: "Résultats par liste" })).toBeInTheDocument();
    const lignes = within(getByRole("table")).getAllByRole("row");
    expect(lignes[1]).toHaveTextContent("1 siège");
    expect(lignes[2]).toHaveTextContent("Nuance non classée");
    expect(within(lignes[2] as HTMLElement).getAllByText("—")).toHaveLength(2);
  });

  it("aucune liste : le tableau reste, vide", () => {
    const { getByRole } = renderScreen(
      <ResultatsParListe tour={tour({ lignes: [] })} nbSieges={2} />,
    );
    expect(getByRole("table")).toBeInTheDocument();
    expect(within(getByRole("table")).getAllByRole("row")).toHaveLength(1);
  });
});

describe("TourMajoritaire", () => {
  const lignesMajoritaire = [
    ligne({
      libelle: "Camille Fictif",
      candidats: [
        candidat({
          prenom: "Camille",
          nom: "Fictif",
          sexe: "F",
          sortant: true,
          personne: { slug: "camille-fictif", chambre: "senat", actif: true, photoUrl: null },
        }),
        candidat({ prenom: "Alix", nom: "Essai", sexe: "F", role: "suppleant" }),
      ],
    }),
    ligne({
      sourceUid: "l2",
      libelle: "Hervé Exemple",
      elu: false,
      nuanceLibelle: null,
      famille: "droite",
      candidats: [
        candidat({ prenom: "Hervé" }),
        candidat({ prenom: "Noa", nom: "Témoin", role: "suppleant" }),
      ],
    }),
  ];

  it("1er tour : titulaire lié, sortante, remplaçante, élue, et la règle d'élection", () => {
    const { getByRole, getByText } = renderScreen(
      <TourMajoritaire tour={tour({ lignes: lignesMajoritaire })} rappel={false} />,
    );
    expect(getByRole("heading", { name: "Résultats du 1er tour" })).toBeInTheDocument();
    expect(getByText("Publiés à 12h10, heure de Paris")).toBeInTheDocument();
    expect(getByRole("link", { name: "Camille Fictif" })).toHaveAttribute(
      "href",
      "/senateurs/camille-fictif",
    );
    expect(getByText("sortante")).toBeInTheDocument();
    expect(getByText(/remplaçante : Alix Essai/)).toBeInTheDocument();
    expect(getByText("élue")).toBeInTheDocument();
    expect(getByText(/Droite · remplaçant : Noa Témoin/)).toBeInTheDocument();
    expect(getByText(/Est élu au 1er tour le candidat/)).toBeInTheDocument();
  });

  it("rappel du 1er tour : pas de règle d'élection", () => {
    const { getByRole, queryByText } = renderScreen(
      <TourMajoritaire tour={tour({ lignes: lignesMajoritaire })} rappel />,
    );
    expect(getByRole("heading", { name: "Rappel du 1er tour" })).toBeInTheDocument();
    expect(queryByText(/Est élu au 1er tour/)).toBeNull();
  });

  it("2nd tour, lignes sans candidats", () => {
    const { getByRole, queryByText, getByText } = renderScreen(
      <TourMajoritaire
        tour={tour({ tour: 2, lignes: [ligne({ libelle: "Binôme fictif", elu: true })] })}
        rappel={false}
      />,
    );
    expect(getByRole("heading", { name: "Résultats du 2nd tour" })).toBeInTheDocument();
    expect(getByRole("table", { name: "Voix par candidat, 2nd tour" })).toBeInTheDocument();
    expect(getByText("élu")).toBeInTheDocument();
    expect(queryByText(/Est élu au 1er tour/)).toBeNull();
  });

  it("1er tour sans aucun candidat connu : pas de règle d'élection", () => {
    const { queryByText } = renderScreen(
      <TourMajoritaire tour={tour({ lignes: [ligne({ elu: null })] })} rappel={false} />,
    );
    expect(queryByText(/Est élu au 1er tour/)).toBeNull();
  });
});

describe("RepartitionSieges", () => {
  const repartition = resultatsGirondeExemple.repartition;
  if (!repartition) throw new Error("fixture sans répartition");

  it("un seul siège, toutes les listes élues : pas de liste suivante ni de reste", () => {
    const { getByRole, queryByText } = renderScreen(
      <RepartitionSieges
        repartition={{
          listes: [
            {
              sourceUid: "l1",
              libelle: "Liste Exemple",
              famille: "centre",
              voix: 100,
              moyennes: [100],
              sieges: 1,
            },
          ],
          attributions: [{ sourceUid: "l1", diviseur: 1, rang: 1 }],
        }}
        nbSieges={1}
      />,
    );
    expect(getByRole("heading", { name: "Comment le siège a été attribué" })).toBeInTheDocument();
    expect(getByRole("cell", { name: /1er siège/ })).toBeInTheDocument();
    expect(queryByText(/Le dernier siège s'est joué/)).toBeNull();
    expect(queryByText(/pas détaillée/)).toBeNull();
  });

  it("aucune attribution : pas de comparaison, une seule autre liste non détaillée", () => {
    const { getByText, queryByText } = renderScreen(
      <RepartitionSieges
        repartition={{
          listes: [
            ...repartition.listes,
            {
              sourceUid: "l3",
              libelle: "Liste Modèle",
              famille: null,
              voix: 300,
              moyennes: [300],
              sieges: 0,
            },
            {
              sourceUid: "l4",
              libelle: "Liste Essai",
              famille: null,
              voix: 50,
              moyennes: [50],
              sieges: 0,
            },
          ],
          attributions: [],
        }}
        nbSieges={6}
      />,
    );
    expect(queryByText(/Le dernier siège s'est joué/)).toBeNull();
    expect(getByText(/première moyenne sans siège/)).toBeInTheDocument();
    expect(
      getByText(/L'autre liste, qui a moins de voix, n'est pas détaillée/),
    ).toBeInTheDocument();
  });

  it("plusieurs listes non détaillées, et le dernier siège comparé à la première sans siège", () => {
    const sansSiege = (uid: string, voix: number) => ({
      sourceUid: uid,
      libelle: `Liste ${uid}`,
      famille: null,
      voix,
      moyennes: [voix],
      sieges: 0,
    });
    const { getByText } = renderScreen(
      <RepartitionSieges
        repartition={{
          ...repartition,
          listes: [
            ...repartition.listes,
            sansSiege("x", 100),
            sansSiege("y", 300),
            sansSiege("z", 50),
          ],
        }}
        nbSieges={6}
      />,
    );
    expect(getByText(/Le dernier siège s'est joué à 400 contre 300 pour Liste y/)).toBeVisible();
    expect(
      getByText(/Les 2 autres listes, qui ont moins de voix, ne sont pas détaillées/),
    ).toBeVisible();
  });

  it("dernière attribution sur une liste inconnue : moyenne nulle", () => {
    const { getByText } = renderScreen(
      <RepartitionSieges
        repartition={{
          listes: [
            ...repartition.listes,
            {
              sourceUid: "l3",
              libelle: "Liste Modèle",
              famille: null,
              voix: 10,
              moyennes: [],
              sieges: 0,
            },
          ],
          attributions: [{ sourceUid: "inconnue", diviseur: 1, rang: 1 }],
        }}
        nbSieges={6}
      />,
    );
    expect(getByText(/Le dernier siège s'est joué à 0 contre 10 pour Liste Modèle/)).toBeVisible();
  });
});

describe("BlocParticipation", () => {
  it("aucun inscrit : le taux de participation est un tiret", () => {
    const { getByRole, getByText } = renderScreen(
      <BlocParticipation
        participation={{ inscrits: 0, abstentions: 0, votants: 0, blancs: 0, nuls: 0, exprimes: 0 }}
        titre="Participation au 1er tour"
      />,
    );
    expect(getByRole("heading", { name: "Participation au 1er tour" })).toBeInTheDocument();
    expect(getByText("votants · —")).toBeInTheDocument();
  });
});

describe("ListesEtCandidats", () => {
  it("listes élues avec ligne de flottaison, listes sans élu repliées avec leurs sortants", () => {
    const { getByRole, getByText, getAllByText } = renderScreen(
      <ListesEtCandidats
        tour={tour({
          lignes: [
            ligne({
              nuanceLibelle: null,
              sieges: 1,
              candidats: [
                candidat({
                  sexe: "F",
                  prenom: "Camille",
                  nom: "Fictif",
                  elu: true,
                  sortant: true,
                  personne: {
                    slug: "camille-fictif",
                    chambre: "assemblee",
                    actif: true,
                    photoUrl: null,
                  },
                }),
                candidat({ ordre: 2, prenom: "Alix", nom: "Essai", anneeNaissance: null }),
                candidat({ ordre: 1, role: "suppleant", prenom: "Noa" }),
              ],
            }),
            ligne({
              sourceUid: "l2",
              libelle: "Liste Témoin",
              sieges: null,
              pctExprimes: 12.5,
              candidats: [
                candidat({ prenom: "Hervé", sortant: true }),
                candidat({
                  ordre: 2,
                  prenom: "Lou",
                  nom: "Modèle",
                  sexe: "F",
                  sortant: true,
                  profession: null,
                }),
              ],
            }),
            ligne({
              sourceUid: "l3",
              libelle: "Liste Essai",
              sieges: 0,
              nuanceLibelle: null,
              famille: null,
              candidats: [candidat({ elu: true, prenom: "Sam" })],
            }),
          ],
        })}
      />,
    );
    expect(getByRole("heading", { name: "Les 3 listes et leurs candidats" })).toBeInTheDocument();
    expect(getByRole("heading", { level: 3, name: "Liste Exemple" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Camille Fictif" })).toHaveAttribute(
      "href",
      "/deputes/camille-fictif",
    );
    expect(getAllByText("sortante")).toHaveLength(2);
    expect(getByText("élue")).toBeInTheDocument();
    expect(getByText("Cadre · née en 1970")).toBeInTheDocument();
    expect(getAllByText("Cadre").length).toBeGreaterThan(0);
    expect(getByText(/· 1 000 voix · 1 siège/)).toBeInTheDocument();
    expect(
      getByText(/aucun élu · dont 2 sortants : Hervé Exemple, Lou Modèle/),
    ).toBeInTheDocument();
    expect(getByText("Voir les 2 candidats")).toBeInTheDocument();
    expect(getByText("Voir les 1 candidats")).toBeInTheDocument();
    expect(getByText("née en 1970")).toBeInTheDocument();
    expect(getByText("élu")).toBeInTheDocument();
  });
});

describe("AttenteResultats", () => {
  const avecCirco = (
    extra: Partial<ResultatsCirconscription["circonscription"]>,
  ): ResultatsCirconscription => ({
    ...resultatsGirondeExemple,
    tours: [],
    circonscription: { ...resultatsGirondeExemple.circonscription, ...extra },
  });

  it("proportionnel, bureaux pas encore ouverts", () => {
    const { getByRole, getByText } = renderScreen(
      <AttenteResultats
        resultats={avecCirco({ statut: "pas_ouvert" })}
        maintenant="2026-09-27T07:00:00+02:00"
        nbListes={1}
        sortantsCandidats={1}
        nbSortants={3}
      />,
    );
    expect(
      getByRole("heading", { name: "Le scrutin ouvre à 8h30, heure de Paris" }),
    ).toBeInTheDocument();
    expect(getByText(/Ouverture du scrutin/)).toHaveTextContent("(à venir)");
    expect(getByText("liste en lice")).toBeInTheDocument();
    expect(getByText("grands électeurs")).toBeInTheDocument();
    expect(getByText("1 sur 3")).toBeInTheDocument();
    expect(getByText(/Scrutin proportionnel à un tour/)).toBeInTheDocument();
  });

  it("majoritaire, vote en cours, outre-mer, sans grands électeurs connus", () => {
    const { getByRole, getByText, queryByText } = renderScreen(
      <AttenteResultats
        resultats={avecCirco({
          departement: "973",
          nom: "Guyane",
          nbSieges: 1,
          modeScrutin: "majoritaire",
          statut: "vote_en_cours",
          grandsElecteurs: null,
        })}
        maintenant="2026-09-27T10:00:00+02:00"
        nbListes={2}
        sortantsCandidats={0}
        nbSortants={1}
      />,
    );
    expect(
      getByRole("heading", { name: "Le vote est en cours jusqu'à 17h30" }),
    ).toBeInTheDocument();
    expect(getByText(/Ouverture du 1er tour/)).toHaveTextContent("(fait)");
    expect(getByText("17h30 → 17h30")).toBeInTheDocument();
    expect(getByText(/Horaires convertis en heure de Paris/)).toBeInTheDocument();
    expect(getByText("siège à pourvoir")).toBeInTheDocument();
    expect(getByText("candidatures")).toBeInTheDocument();
    expect(queryByText("grands électeurs")).toBeNull();
    expect(getByText("Scrutin majoritaire à deux tours, le même jour.")).toBeInTheDocument();
  });

  it("majoritaire clos, 2nd tour passé", () => {
    const { getByRole, getByText } = renderScreen(
      <AttenteResultats
        resultats={avecCirco({
          modeScrutin: "majoritaire",
          statut: "resultats_attendus",
          horaires: {
            ouverture: "2026-09-27T08:30:00+02:00",
            cloture: "2026-09-27T11:00:00+02:00",
            ouvertureT2: "2026-09-27T15:30:00+02:00",
            clotureT2: "2026-09-27T17:30:00+02:00",
          },
        })}
        maintenant="2026-09-27T18:00:00+02:00"
        nbListes={1}
        sortantsCandidats={0}
        nbSortants={0}
      />,
    );
    expect(getByRole("heading", { name: "Le scrutin est clos depuis 11h00" })).toBeInTheDocument();
    expect(getByText("15h30 → 17h30")).toBeInTheDocument();
    expect(getByText(/2nd tour, si un siège reste à pourvoir/)).toHaveTextContent("(fait)");
    expect(getByText("candidature")).toBeInTheDocument();
  });
});
