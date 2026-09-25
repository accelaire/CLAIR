/**
 * Résultats des sénatoriales du 27 septembre 2026 : types de l'API et libellés.
 *
 * Les chiffres sont PROVISOIRES : ils viennent du site de résultats du
 * ministère de l'Intérieur, qui les publie « sous réserve d'éventuelles
 * corrections et des décisions du juge de l'élection ». Chaque affichage le
 * rappelle, avec la source et l'heure de mise à jour.
 */
import type { Sortant } from '@/app/senatoriales-2026/PageClient';
import { FAMILLES } from './familles';

export type StatutCirconscription =
  | 'pas_ouvert'
  | 'vote_en_cours'
  | 'resultats_attendus'
  | 'second_tour'
  | 'partielle'
  | 'pourvue';

export type EtapeSecondTour = 'a_venir' | 'en_cours' | 'clos';

export interface Horaires {
  ouverture: string;
  cloture: string;
  ouvertureT2: string | null;
  clotureT2: string | null;
}

export interface ResumeCirconscription {
  departement: string;
  nom: string;
  nbSieges: number;
  modeScrutin: string;
  statut: StatutCirconscription;
  secondTour: EtapeSecondTour | null;
  sieges: ({ famille: string | null; nuance: string | null } | null)[];
  horaires: Horaires;
}

export interface ResultatsNationaux {
  maintenant: string;
  verifieA: string | null;
  publieA: string | null;
  source: string;
  compteurs: Record<StatutCirconscription, number> & {
    circonscriptions: number;
    sieges: number;
    siegesAttribues: number;
  };
  circonscriptions: ResumeCirconscription[];
  hemicycle: {
    avant: Record<string, number>;
    apres: Record<string, number>;
    total: number;
    notes: string[];
  };
}

export interface PersonneElu {
  slug: string;
  chambre: string;
  actif: boolean;
  photoUrl: string | null;
}

export interface Elu {
  nom: string;
  prenom: string;
  sexe: string | null;
  anneeNaissance: number | null;
  profession: string | null;
  tour: number;
  liste: string | null;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  parcours: 'reelu' | 'parlementaire' | 'nouveau';
  personne: PersonneElu | null;
}

export interface CandidatResultat {
  nom: string;
  prenom: string;
  sexe: string | null;
  anneeNaissance: number | null;
  profession: string | null;
  ordre: number;
  role: string;
  sortant: boolean;
  elu: boolean;
  personne: PersonneElu | null;
}

export interface LigneResultat {
  sourceUid: string;
  libelle: string;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  voix: number;
  pctInscrits: number | null;
  pctExprimes: number | null;
  sieges: number | null;
  elu: boolean | null;
  candidats: CandidatResultat[];
}

export interface Participation {
  inscrits: number;
  abstentions: number;
  votants: number;
  blancs: number;
  nuls: number;
  exprimes: number;
}

export interface TourResultat {
  tour: number;
  publieA: string;
  verifieA: string;
  sourceUrl: string;
  participation: Participation;
  lignes: LigneResultat[];
}

export type SortDuSortant = 'reelu' | 'battu' | 'ne_se_representait_pas' | 'en_attente';

export interface ResultatsCirconscription {
  maintenant: string;
  source: string;
  circonscription: ResumeCirconscription & { grandsElecteurs: number | null };
  tours: TourResultat[];
  elus: Elu[];
  repartition: {
    listes: {
      sourceUid: string;
      libelle: string;
      famille: string | null;
      voix: number;
      moyennes: number[];
      sieges: number;
    }[];
    attributions: { sourceUid: string; diviseur: number; rang: number }[];
  } | null;
  sortants: (Sortant & { sort: SortDuSortant })[];
}

/** Libellé court de l'état d'une circonscription, celui des vignettes. */
export function libelleStatut(statut: StatutCirconscription, secondTour: EtapeSecondTour | null): string {
  switch (statut) {
    case 'pas_ouvert':
      return 'Vote pas encore ouvert';
    case 'vote_en_cours':
      return 'Vote en cours';
    case 'resultats_attendus':
      return 'Résultats attendus';
    case 'second_tour':
      return secondTour === 'en_cours'
        ? '2nd tour en cours'
        : secondTour === 'clos'
          ? '2nd tour clos, résultats attendus'
          : '2nd tour à venir';
    case 'partielle':
      return 'Résultats partiels';
    case 'pourvue':
      return 'Résultats connus';
  }
}

/** « 20h14 », heure de Paris, quel que soit le fuseau du lecteur ou du serveur. */
export function heureDeParis(iso: string): string {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: 'numeric',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const h = parties.find((p) => p.type === 'hour')?.value ?? '';
  const m = parties.find((p) => p.type === 'minute')?.value ?? '';
  return `${h}h${m}`;
}

/** « dimanche 27 septembre », heure de Paris. */
export function jourDeParis(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

export function nombre(n: number): string {
  return n.toLocaleString('fr-FR');
}

export function pourcentage(valeur: number | null, decimales = 1): string {
  if (valeur === null) return '—';
  return `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`;
}

/** Accord au féminin quand la source dit « F » ; sinon masculin, la règle d'usage. */
export function accorder(sexe: string | null | undefined, masculin: string, feminin: string): string {
  return sexe === 'F' ? feminin : masculin;
}

export function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`): string {
  return n > 1 ? plurielForme : singulier;
}

/** Badge du parcours d'un élu : ce que CLAIR sait de lui avant son élection. */
export function libelleParcours(elu: Pick<Elu, 'parcours' | 'personne' | 'sexe'>): string {
  const f = elu.sexe === 'F';
  if (elu.parcours === 'reelu') return f ? 'réélue' : 'réélu';
  if (elu.parcours === 'parlementaire' && elu.personne) {
    if (elu.personne.chambre === 'assemblee') {
      return elu.personne.actif ? (f ? 'députée' : 'député') : f ? 'ancienne députée' : 'ancien député';
    }
    return f ? 'ancienne sénatrice' : 'ancien sénateur';
  }
  return f ? 'nouvelle au Parlement' : 'nouveau au Parlement';
}

/**
 * Catégories de l'hémicycle.
 *
 * Les familles positionnées s'étagent de gauche à droite sur l'arc. Les autres
 * ne se placent pas sur un axe gauche-droite : les mettre dans l'arc leur
 * donnerait une position qu'elles n'ont pas. Elles sont comptées à part.
 */
export const FAMILLES_ARC = ['gauche', 'centre', 'droite', 'droite_ou_extreme_droite', 'extreme_droite'] as const;
export const HORS_ARC = ['regionaliste', 'divers', 'non_classee', 'non_publiee', 'non_attribue'] as const;

export const CATEGORIES_HEMICYCLE: Record<string, { libelle: string; couleur: string }> = {
  ...FAMILLES,
  non_classee: { libelle: 'Nuance non classée', couleur: '#9ca3af' },
  non_publiee: { libelle: 'Nuance non publiée', couleur: '#6b7280' },
  non_attribue: { libelle: 'Siège non attribué', couleur: 'transparent' },
};
