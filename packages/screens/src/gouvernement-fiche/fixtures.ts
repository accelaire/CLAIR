import type {
  GouvernementDetail,
  GouvernementDetailReponse,
  MotionCensure,
  PosteMinisteriel,
} from "@clair/data";
import { personneFictive } from "../gouvernements-liste/fixtures.ts";

/**
 * Données FICTIVES pour les tests et les stories : un gouvernement, ses membres, ses textes et
 * ses motions sont inventés. Ils ne décrivent aucun gouvernement réel.
 */

const pm = personneFictive("PA1", "Camille", "Fictif", "M.", "camille-fictif");
const alix = personneFictive("PA2", "Alix", "Exemple", "Mme", "alix-exemple");
const noa = personneFictive("PA3", "Noa", "Modèle");
const sam = personneFictive("PA4", "Sam", "Essai", "Mme");

const poste = (
  uid: string,
  membre: PosteMinisteriel["membre"],
  surcharge: Partial<PosteMinisteriel>,
): PosteMinisteriel => ({
  uid,
  organeUid: `PO-${uid}`,
  qualite: "Ministre",
  rangProtocolaire: 20,
  intitule: "Ministère de l'exemple",
  intituleCourt: "Exemple",
  intituleComplement: null,
  domaine: "economie",
  dateDebut: "2025-09-10",
  dateFin: null,
  datePublication: null,
  membre,
  ...surcharge,
});

export const postesFictifs: PosteMinisteriel[] = [
  poste("PM1", pm, {
    qualite: "Premier ministre",
    rangProtocolaire: 1,
    intitule: "Premier ministre",
    intituleCourt: "Premier ministre",
    domaine: "premier-ministre",
  }),
  poste("PM2", alix, {
    intitule: "Ministère des armées",
    intituleCourt: "Armées",
    domaine: "defense",
    dateDebut: "2025-09-20",
  }),
  poste("PM3", noa, { dateDebut: "2025-09-20", dateFin: "2026-02-26" }),
  poste("PM4", sam, { dateDebut: "2026-02-27" }),
];

export const motionFictive: MotionCensure = {
  date: "2026-01-15",
  alinea: 3,
  premierSignataire: "Mme Lou Exemple",
  pour: 250,
  majoriteRequise: 289,
  adoptee: false,
  scrutin: { numero: 1234, chambre: "assemblee", session: "17" },
  engagementDossierUid: "DLR-FICTIF-1",
};

export const gouvernementFictif: GouvernementDetail = {
  uid: "PO-G3",
  slug: "fictif-ii",
  nom: "Fictif II",
  numero: 2,
  dateDebut: "2025-09-10",
  dateFin: null,
  enCours: true,
  premierMinistre: pm,
  presidence: { uid: "PO-PRES-A", civilite: "Mme", prenom: "Ariane", nom: "Exemple" },
  nbPostes: 4,
  nbMembres: 4,
  nbFemmes: 2,
  couverture: "depuis_2017",
  precedent: { slug: "fictif-i", nom: "Fictif I" },
  suivant: null,
  postes: postesFictifs,
  bilan: {
    textes: {
      total: 2,
      portes: 1,
      parNature: {
        ordinaire: 1,
        ratification_ordonnance: 1,
        convention: 0,
        finances: 0,
        constitutionnelle: 0,
        organique: 0,
      },
      parStadePortes: { promulgue: 1, adopte: 0, examine: 0, depose: 0 },
      liste: [
        {
          dossier: { uid: "DLR-FICTIF-1", titre: "Projet de loi relatif à l'exemple" },
          nature: "ordinaire",
          stade: "promulgue",
          chambreDepot: "assemblee",
          dateDepot: "2025-10-01",
          loi: { numero: "2026-1", urlLegifrance: "https://example.org/loi" },
          chefDeFile: {
            posteUid: "PM2",
            intitule: "Ministère des armées",
            intituleCourt: "Armées",
            domaine: "defense",
            membre: alix,
          },
        },
        {
          dossier: { uid: "DLR-FICTIF-2", titre: "Projet de loi ratifiant l'ordonnance fictive" },
          nature: "ratification_ordonnance",
          stade: "depose",
          chambreDepot: "senat",
          dateDepot: "2025-11-01",
          loi: null,
          chefDeFile: null,
        },
      ],
    },
    engagements: [
      {
        date: "2026-01-10",
        dossier: { uid: "DLR-FICTIF-1", titre: "Projet de loi relatif à l'exemple" },
        texte: null,
        motions: [motionFictive],
      },
    ],
    motions: { total: 1, alinea2: 0, alinea3: 1, adoptees: 0, liste: [motionFictive] },
  },
};

/** Un gouvernement fini avant juin 2017 : pas de bilan (et non zéro). */
export const gouvernementAncienFictif: GouvernementDetail = {
  ...gouvernementFictif,
  uid: "PO-G1",
  slug: "imaginaire",
  nom: "Imaginaire",
  dateDebut: "2010-05-17",
  dateFin: "2012-05-10",
  enCours: false,
  couverture: "avant_2017",
  bilan: null,
  precedent: null,
  suivant: { slug: "fictif-i", nom: "Fictif I" },
  postes: postesFictifs.map((p) => ({ ...p, dateDebut: "2010-05-17", dateFin: "2012-05-10" })),
};

export const reponseFictive = (
  data: GouvernementDetail = gouvernementFictif,
): GouvernementDetailReponse => ({
  data,
  domaines: [
    { cle: "premier-ministre", libelle: "Premier ministre" },
    { cle: "defense", libelle: "Armées et anciens combattants" },
    { cle: "economie", libelle: "Économie, finances et entreprises" },
  ],
  source: { nom: "open data de l’Assemblée nationale (fixture)", url: "https://example.org/amo" },
  sourceBilan: {
    nom: "dossiers législatifs et scrutins (fixture)",
    url: "https://example.org/bilan",
  },
});
