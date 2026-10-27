/**
 * Données d'exemple des composants parlementaires (cartes, badges, résultats de vote), pour les
 * stories et les tests. Personnes, textes et chiffres FICTIFS : seuls les sigles de groupes sont
 * réels, et aucune donnée n'attribue un vote ou une déclaration à un élu réel.
 */
import type { AmendementCardData } from "./amendement-card/AmendementCard.tsx";
import type { DossierCardData } from "./dossier-card/DossierCard.tsx";
import type { ParlementaireCardData } from "./parlementaire-card/ParlementaireCard.tsx";
import type { ScrutinCardData } from "./scrutin-card/ScrutinCard.tsx";

/** Groupes de l'Assemblée (sigles réels, couleur de l'API absente : repli sur les tokens). */
export const groupesAssemblee = [
  { sigle: "EPR", nom: "Ensemble pour la République" },
  { sigle: "LFI", nom: "La France insoumise - Nouveau Front Populaire" },
  { sigle: "RN", nom: "Rassemblement National" },
  { sigle: "DR", nom: "Droite Républicaine" },
  { sigle: "SOC", nom: "Socialistes et apparentés" },
  { sigle: "ECO", nom: "Écologiste et Social" },
  { sigle: "DEM", nom: "Les Démocrates" },
  { sigle: "HOR", nom: "Horizons & Indépendants" },
  { sigle: "GDR", nom: "Gauche Démocrate et Républicaine" },
  { sigle: "LIOT", nom: "Libertés, Indépendants, Outre-mer et Territoires" },
  { sigle: "UDI", nom: "UDI et Indépendants" },
  { sigle: "NI", nom: "Non inscrits" },
];

/** Groupes du Sénat : pas de token propre, la couleur vient de l'API (valeurs d'exemple). */
export const groupesSenat = [
  { sigle: "LR", nom: "Les Républicains", couleur: "#0066CC" },
  { sigle: "SER", nom: "Socialiste, Écologiste et Républicain", couleur: "#FF8080" },
  { sigle: "UC", nom: "Union Centriste", couleur: "#00BFFF" },
  {
    sigle: "RDPI",
    nom: "Rassemblement des démocrates, progressistes et indépendants",
    couleur: "#FFEB00",
  },
  {
    sigle: "CRCE-K",
    nom: "Communiste Républicain Citoyen et Écologiste - Kanaky",
    couleur: "204,36,67",
  },
  { sigle: "GEST", nom: "Écologiste - Solidarité et Territoires", couleur: "#00C000" },
  { sigle: "RDSE", nom: "Rassemblement Démocratique et Social Européen", couleur: "#FF9900" },
  { sigle: "LIRT", nom: "Les Indépendants - République et Territoires", couleur: "#0D378A" },
];

export const deputeExemple: ParlementaireCardData = {
  prenom: "Camille",
  nom: "Exemple",
  sexe: "F",
  photoUrl: null,
  actif: true,
  groupe: { nom: "ECO", nomComplet: "Écologiste et Social", couleur: null },
  circonscription: { nom: "Exemple-sur-Mer", departement: "99", numero: 1 },
};

export const senateurExemple: ParlementaireCardData = {
  prenom: "Dominique",
  nom: "Modèle",
  sexe: "M",
  photoUrl: null,
  actif: true,
  groupe: { nom: "UC", nomComplet: "Union Centriste", couleur: "#00BFFF" },
  circonscription: { nom: "Département-Modèle", departement: "98", numero: 0 },
};

export const ancienDeputeExemple: ParlementaireCardData = {
  prenom: "Alex",
  nom: "Fictif",
  sexe: "M",
  photoUrl: null,
  actif: false,
  groupe: null,
  circonscription: { nom: "Ville-Témoin", departement: "97", numero: 3 },
};

export const scrutinAdopte: ScrutinCardData = {
  numero: 1234,
  chambre: "assemblee",
  date: "2025-11-18T15:00:00.000Z",
  titre: "l'ensemble du projet de loi d'exemple relatif à la simplification administrative",
  sort: "adopté",
  typeVote: "solennel",
  importance: 4,
  nombrePour: 312,
  nombreContre: 205,
  nombreAbstention: 41,
};

export const scrutinRejete: ScrutinCardData = {
  numero: 87,
  chambre: "senat",
  date: "2026-02-03T10:30:00.000Z",
  titre: "l'amendement n° 12 d'exemple à l'article 3 du projet de loi fictif",
  sort: "rejeté",
  typeVote: "ordinaire",
  importance: 2,
  nombrePour: 98,
  nombreContre: 230,
  nombreAbstention: 15,
};

export const dossierEnCours: DossierCardData = {
  titre: "relative à la protection des exemples dans l'espace public",
  procedureLibelle: "Proposition de loi",
  etat: "en_cours",
  chambre: "assemblee",
  lastScrutinDate: "2026-01-20T00:00:00.000Z",
  nbScrutins: 4,
  nbAmendements: 128,
};

export const dossierPromulgue: DossierCardData = {
  titre: "Projet de loi d'exemple pour la simplification administrative",
  procedureLibelle: "Projet de loi",
  etat: "promulgue",
  chambre: "senat",
  dateDepot: "2025-03-12T00:00:00.000Z",
  nbScrutins: 7,
  loiNumero: "2026-0000",
  loiDateJO: "2026-04-02T00:00:00.000Z",
  urlLegifrance: "https://www.legifrance.gouv.fr",
  urlJournalOfficiel: "https://www.journal-officiel.gouv.fr",
};

const exposeLong =
  "Cet amendement d'exemple vise à préciser la rédaction de l'article afin de lever une ambiguïté sur le champ d'application du dispositif. Il prévoit que les modalités seront fixées par décret, après consultation des collectivités concernées. Le texte est fictif et ne sert qu'à illustrer le composant : il ne reproduit aucun amendement réellement déposé.";

export const amendementAdopte: AmendementCardData = {
  numero: "42",
  articleVise: "Article 3",
  alinea: "alinéa 2",
  auteurLibelle: "Mme Camille Exemple",
  sort: "Adopté",
  exposeSommaire: `<p>${exposeLong}</p>`,
  dispositif: "<p>À l'alinéa 2, après le mot : « exemple », insérer les mots : « fictif ».</p>",
  dateDepot: "2026-01-12T00:00:00.000Z",
  texteRef: "PRJLANR5L17B0000",
};

export const sousAmendement: AmendementCardData = {
  numero: "142",
  articleVise: "Article 3",
  auteurLibelle: "M. Dominique Modèle",
  sort: "rejete",
  exposeSommaire: "Sous-amendement de précision rédactionnelle.",
  dateDepot: "2026-01-13T00:00:00.000Z",
  amendementParent: { numero: "42", auteurLibelle: "Mme Camille Exemple, M. Alex Fictif" },
};

export const lobbyisteExemple = {
  nom: "Fédération Exemple des Industries Fictives",
  logoUrl: null,
};
