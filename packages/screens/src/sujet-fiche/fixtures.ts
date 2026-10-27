import type {
  PageMeta,
  SujetDetail,
  SujetDocumentLie,
  SujetDossier,
  SujetEtapeParcours,
  SujetScrutin,
  SujetStatsResponse,
} from "@clair/data";

/**
 * Données FICTIVES de la fiche d'un sujet (tests, stories) : textes, personnes et chiffres
 * inventés, présentés comme exemples.
 */
export const SLUG_EXEMPLE = "exemple-reforme-des-jardins-partages";

export const sujetExemple: SujetDetail = {
  id: "sujet-exemple-1",
  slug: SLUG_EXEMPLE,
  label: "Exemple : réforme des jardins partagés",
  description: "Sujet fictif servant d'exemple.",
  category: "Exemple",
  dossierCount: 2,
  scrutinCount: 2,
  matchMethod: "cross_ref",
  status: "en_cours",
  dateDebut: "2026-01-15T00:00:00.000Z",
  dateFin: null,
  dateDernierVote: "2026-05-20T00:00:00.000Z",
  featured: false,
  featuredOrder: 0,
  createdAt: "2026-01-16T00:00:00.000Z",
  resume: "Résumé d'exemple : le texte fictif encadre les jardins partagés.",
  enjeux: "Enjeux d'exemple : l'accès aux parcelles.",
  liens: {
    construction: [
      {
        id: "lien-1",
        famille: "construction",
        titre: "Étude d'impact (exemple)",
        url: "https://example.org/etude",
        source: "exemple",
        sourceLabel: "Exemple",
        datePublication: null,
        ordre: 1,
      },
    ],
    contexte: [],
  },
};

const dossierBase: SujetDossier = {
  id: "dossier-exemple-1",
  uid: "DLR5L17N00001",
  titre: "relative aux jardins partagés (exemple)",
  titreCourt: null,
  chambre: "assemblee",
  procedureCode: null,
  procedureLibelle: "Proposition de loi",
  urlAN: "https://example.org/an",
  urlSenat: null,
  etat: "adopte",
  dateDepot: "2026-01-15T00:00:00.000Z",
  dateAdoption: "2026-03-01T00:00:00.000Z",
  loiNumero: null,
  loiTitre: null,
  loiDateJO: null,
  urlLegifrance: null,
  urlJournalOfficiel: null,
  scrutinCount: 1,
  legislativeSteps: [],
};

export const dossiersExemple: PageMeta<SujetDossier> = {
  data: [
    dossierBase,
    {
      ...dossierBase,
      id: "dossier-exemple-2",
      uid: "SENAT-EXEMPLE-1",
      chambre: "senat",
      etat: "en_cours",
      urlAN: null,
      urlSenat: "https://example.org/senat",
      dateAdoption: null,
    },
  ],
  meta: { total: 2, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
};

export const scrutinsExemple: PageMeta<SujetScrutin> = {
  data: [
    {
      id: "scrutin-exemple-1",
      numero: 42,
      chambre: "senat",
      session: "2025",
      date: "2026-05-20T00:00:00.000Z",
      titre: "Exemple : l'ensemble de la proposition de loi relative aux jardins partagés",
      typeVote: "ordinaire",
      natureVote: "ensemble",
      sort: "adopte",
      nombrePour: 200,
      nombreContre: 100,
      nombreAbstention: 10,
      tags: [],
      importance: 3,
    },
  ],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
};

export const statsExemple: SujetStatsResponse = {
  data: [
    {
      nom: "EXA",
      slug: "exa",
      couleur: "#336699",
      chambre: "assemblee",
      votes: { pour: 10, contre: 2, abstention: 1, absent: 0 },
      amendements: 4,
    },
    {
      nom: "EXB",
      slug: "exb",
      couleur: null,
      chambre: "senat",
      votes: { pour: 1, contre: 20, abstention: 0, absent: 0 },
      amendements: 0,
    },
  ],
  groupeAmendementDescriptions: {
    "exa-assemblee": "Position d'exemple rédigée pour les tests.",
  },
};

export const chronologieExemple: { data: SujetEtapeParcours[] } = {
  data: [
    {
      uid: "SEANCE-EXEMPLE-1",
      textes: [{ uid: "DLR5L17N00001", titre: "Texte d'exemple" }],
      type: "seance",
      date: "2026-03-01T14:00:00.000Z",
      chambre: "assemblee",
      commission: null,
      nbPrises: 12,
      nbAvis: null,
      consultable: true,
      scrutins: [],
    },
  ],
};

export const documentsLiesExemple: { data: SujetDocumentLie[] } = { data: [] };

/** Toutes les routes de la fiche d'exemple, pour `renderScreen`. */
export const routesSujetExemple = {
  [`/sujets/${SLUG_EXEMPLE}`]: { data: sujetExemple },
  [`/sujets/${SLUG_EXEMPLE}/dossiers`]: dossiersExemple,
  [`/sujets/${SLUG_EXEMPLE}/scrutins`]: scrutinsExemple,
  [`/sujets/${SLUG_EXEMPLE}/stats`]: statsExemple,
  [`/sujets/${SLUG_EXEMPLE}/chronologie`]: chronologieExemple,
  [`/sujets/${SLUG_EXEMPLE}/documents-lies`]: documentsLiesExemple,
  [`/sujets/${SLUG_EXEMPLE}/presse`]: { data: [] },
};
