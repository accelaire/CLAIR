import type {
  ApercuSenatoriales,
  ListeCandidats,
  ListeSortants,
  ResultatsCirconscription,
  ResultatsNationaux,
  Sortant,
} from "@clair/data";

/**
 * Données FICTIVES de la rubrique Sénatoriales 2026, pour les tests et les stories : personnes,
 * listes et chiffres inventés (« Exemple »), aux formes des réponses de l'API.
 */

const sortant = (
  id: string,
  prenom: string,
  nom: string,
  circonscription: { departement: string; nom: string },
  extra: Partial<Sortant> = {},
): Sortant => ({
  mandatId: `mandat-${id}`,
  personne: {
    id: `personne-${id}`,
    slug: `${prenom}-${nom}`.toLowerCase(),
    nom,
    prenom,
    photoUrl: null,
    profession: "Salariés (Cadres divers)",
    dateNaissance: "1960-05-12",
    sexe: "M",
  },
  groupe: {
    slug: "groupe-exemple-a",
    nom: "Groupe Exemple A",
    nomComplet: "Groupe fictif Exemple A",
    couleur: "#3d6fb4",
    position: "centre",
  },
  circonscription,
  commissionPermanente: "Commission fictive des exemples",
  mandat: {
    dateDebut: "2020-10-01",
    dateFin: null,
    mandatComplet: true,
    dureeMois: 72,
    segments: 1,
    interrompu: false,
  },
  candidature: null,
  bilan: {
    presence: 97,
    loyaute: 99,
    participation: 90,
    interventions: 120,
    amendements: 300,
    calculatedAt: "2026-09-20T00:00:00.000Z",
  },
  ...extra,
});

const AIN = { departement: "01", nom: "Ain" };
const GIRONDE = { departement: "33", nom: "Gironde" };

export const sortantsExemple: Sortant[] = [
  sortant("1", "Hervé", "Exemple", AIN),
  sortant("2", "Camille", "Fictif", AIN, {
    personne: {
      id: "personne-2",
      slug: "camille-fictif",
      nom: "Fictif",
      prenom: "Camille",
      photoUrl: null,
      profession: "Professions libérales (Avocats)",
      dateNaissance: "1972-03-01",
      sexe: "F",
    },
    groupe: null,
    bilan: {
      presence: 45,
      loyaute: null,
      participation: 40,
      interventions: 10,
      amendements: 5,
      calculatedAt: "2026-09-20T00:00:00.000Z",
    },
    mandat: {
      dateDebut: "2024-02-15",
      dateFin: null,
      mandatComplet: false,
      dureeMois: 31,
      segments: 2,
      interrompu: true,
    },
  }),
  sortant("3", "Dominique", "Modèle", GIRONDE, {
    candidature: {
      circonscription: GIRONDE,
      modeScrutin: "proportionnel",
      libelle: "Liste Exemple pour la Gironde",
      nuance: "LEX",
      nuanceLibelle: "Liste fictive",
      famille: "centre",
      ordre: 1,
      role: "titulaire",
    },
  }),
];

export const listeSortants = (data: Sortant[] = sortantsExemple): ListeSortants => ({
  data,
  meta: { total: data.length },
});

export const apercuExemple: ApercuSenatoriales = {
  scrutin: {
    date: "2026-09-27",
    priseDeFonction: "2026-10-01",
    serie: "2",
    mandatureSortante: 2020,
    mandatureEntrante: 2026,
    nbSieges: 178,
    nbCirconscriptions: 64,
    sources: [{ label: "Source fictive", url: "https://exemple.invalid/decret" }],
  },
  sortants: {
    total: 3,
    mandatComplet: 2,
    arriveesEnCours: 1,
    parGroupe: [
      {
        slug: "groupe-exemple-a",
        nom: "Groupe Exemple A",
        nomComplet: "Groupe fictif Exemple A",
        couleur: "#3d6fb4",
        position: "centre",
        sieges: 2,
        siegesSenat: 10,
      },
      {
        slug: "sans-groupe",
        nom: "Sans groupe",
        nomComplet: null,
        couleur: null,
        position: null,
        sieges: 1,
        siegesSenat: 2,
      },
    ],
  },
  circonscriptions: [
    { departement: "01", nom: "Ain", nbSieges: 2, nbListes: null, nbCandidats: null },
    { departement: "33", nom: "Gironde", nbSieges: 6, nbListes: null, nbCandidats: null },
  ],
  candidatures: null,
};

export const apercuAvecCandidatures: ApercuSenatoriales = {
  ...apercuExemple,
  circonscriptions: [
    { departement: "01", nom: "Ain", nbSieges: 2, nbListes: 3, nbCandidats: 6 },
    { departement: "33", nom: "Gironde", nbSieges: 6, nbListes: 2, nbCandidats: 16 },
  ],
  candidatures: {
    listes: 5,
    candidats: 22,
    circonscriptions: 2,
    sortantsCandidats: 1,
    sortantsNonCandidats: 2,
    anciensParlementaires: 1,
  },
};

export const candidatsGironde: ListeCandidats = {
  data: [
    {
      id: "liste-1",
      circonscription: GIRONDE,
      modeScrutin: "proportionnel",
      libelle: "Liste Exemple pour la Gironde",
      nuance: "LEX",
      nuanceLibelle: "Liste fictive",
      famille: "centre",
      candidats: [
        {
          id: "c1",
          nom: "Modèle",
          prenom: "Dominique",
          sexe: "M",
          anneeNaissance: 1960,
          profession: "Cadre",
          ordre: 1,
          role: "titulaire",
          sortant: true,
          personne: { slug: "dominique-modele", chambre: "senat", photoUrl: null },
        },
        {
          id: "c2",
          nom: "Essai",
          prenom: "Alix",
          sexe: "F",
          anneeNaissance: 1985,
          profession: "Enseignante",
          ordre: 2,
          role: "titulaire",
          sortant: false,
          personne: null,
        },
      ],
    },
  ],
  meta: { total: 1, candidats: 2 },
};

const horaires = {
  ouverture: "2026-09-27T08:30:00+02:00",
  cloture: "2026-09-27T17:30:00+02:00",
  ouvertureT2: null,
  clotureT2: null,
};

/** Soirée fictive en cours : l'Ain pourvu, la Gironde en attente. */
export const resultatsNationauxExemple: ResultatsNationaux = {
  maintenant: "2026-09-27T19:00:00+02:00",
  verifieA: "2026-09-27T18:58:00+02:00",
  publieA: "2026-09-27T18:50:00+02:00",
  source: "https://exemple.invalid/resultats",
  compteurs: {
    pas_ouvert: 0,
    vote_en_cours: 0,
    resultats_attendus: 1,
    second_tour: 0,
    partielle: 0,
    pourvue: 1,
    circonscriptions: 2,
    sieges: 8,
    siegesAttribues: 2,
  },
  circonscriptions: [
    {
      departement: "01",
      nom: "Ain",
      nbSieges: 2,
      modeScrutin: "majoritaire",
      statut: "pourvue",
      secondTour: null,
      sieges: [
        { famille: "droite", nuance: "LEX" },
        { famille: "gauche", nuance: "LEY" },
      ],
      horaires,
    },
    {
      departement: "33",
      nom: "Gironde",
      nbSieges: 6,
      modeScrutin: "proportionnel",
      statut: "resultats_attendus",
      secondTour: null,
      sieges: [null, null, null, null, null, null],
      horaires,
    },
  ],
  hemicycle: {
    avant: { gauche: 100, centre: 60, droite: 170, divers: 18 },
    apres: { gauche: 99, centre: 60, droite: 171, divers: 12, non_attribue: 6 },
    total: 348,
    notes: ["Note fictive sur la répartition."],
  },
};

/** Gironde fictive, résultats publiés au proportionnel. */
export const resultatsGirondeExemple: ResultatsCirconscription = {
  maintenant: "2026-09-27T21:00:00+02:00",
  source: "https://exemple.invalid/resultats",
  circonscription: {
    departement: "33",
    nom: "Gironde",
    nbSieges: 6,
    modeScrutin: "proportionnel",
    statut: "pourvue",
    secondTour: null,
    sieges: [],
    horaires,
    grandsElecteurs: 3000,
  },
  tours: [
    {
      tour: 1,
      publieA: "2026-09-27T20:30:00+02:00",
      verifieA: "2026-09-27T20:31:00+02:00",
      sourceUrl: "https://exemple.invalid/resultats/33",
      participation: {
        inscrits: 3000,
        abstentions: 30,
        votants: 2970,
        blancs: 10,
        nuls: 10,
        exprimes: 2950,
      },
      lignes: [
        {
          sourceUid: "l1",
          libelle: "Liste Exemple pour la Gironde",
          nuance: "LEX",
          nuanceLibelle: "Liste fictive",
          famille: "centre",
          voix: 2000,
          pctInscrits: 66.7,
          pctExprimes: 67.8,
          sieges: 5,
          elu: true,
          candidats:
            candidatsGironde.data[0]?.candidats.map(({ id: _id, personne, ...c }) => ({
              ...c,
              personne: personne ? { ...personne, actif: true } : null,
              elu: c.ordre <= 5,
            })) ?? [],
        },
        {
          sourceUid: "l2",
          libelle: "Liste Témoin",
          nuance: "LEY",
          nuanceLibelle: "Autre liste fictive",
          famille: "gauche",
          voix: 950,
          pctInscrits: 31.7,
          pctExprimes: 32.2,
          sieges: 1,
          elu: true,
          candidats: [],
        },
      ],
    },
  ],
  elus: [
    {
      nom: "Modèle",
      prenom: "Dominique",
      sexe: "M",
      anneeNaissance: 1960,
      profession: "Cadre",
      tour: 1,
      liste: "Liste Exemple pour la Gironde",
      nuance: "LEX",
      nuanceLibelle: "Liste fictive",
      famille: "centre",
      parcours: "reelu",
      personne: { slug: "dominique-modele", chambre: "senat", actif: true, photoUrl: null },
      avant: { chambre: "senat", enCours: true },
      slug: null,
      mandatsLocaux: null,
    },
  ],
  repartition: {
    listes: [
      {
        sourceUid: "l1",
        libelle: "Liste Exemple pour la Gironde",
        famille: "centre",
        voix: 2000,
        moyennes: [2000, 1000, 667, 500, 400, 333],
        sieges: 5,
      },
      {
        sourceUid: "l2",
        libelle: "Liste Témoin",
        famille: "gauche",
        voix: 950,
        moyennes: [950, 475, 317, 238, 190, 158],
        sieges: 1,
      },
    ],
    attributions: [
      { sourceUid: "l1", diviseur: 1, rang: 1 },
      { sourceUid: "l2", diviseur: 1, rang: 2 },
      { sourceUid: "l1", diviseur: 2, rang: 3 },
      { sourceUid: "l1", diviseur: 3, rang: 4 },
      { sourceUid: "l1", diviseur: 4, rang: 5 },
      { sourceUid: "l1", diviseur: 5, rang: 6 },
    ],
  },
  sortants: [
    {
      ...(sortantsExemple[2] ?? sortant("3", "Dominique", "Modèle", GIRONDE)),
      sort: "reelu",
    },
  ],
};
