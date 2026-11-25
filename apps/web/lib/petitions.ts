// Pétitions citoyennes : types de l'API (`/api/v1/petitions`) et règles
// d'affichage.
//
// Le statut de la plateforme (`statutSource`) ne dit pas le sort d'une
// pétition : il vaut « ouverte » par défaut à la source, y compris pour la
// n° 3014 dont la collecte est close et le rapport publié. La page montre donc
// la COLLECTE (ouverte ou close) et le PARCOURS (étapes datées et sourcées),
// jamais le statut brut comme un fait.

export type ChambrePetition = 'assemblee' | 'senat';

export type TypeEtapePetition =
  | 'rapporteur'
  | 'decision'
  | 'examen'
  | 'rapport'
  | 'classement'
  | 'seuil_atteint'
  | 'decision_conference';

export interface CommissionDePetition {
  slug: string;
  nom: string;
}

export interface PetitionResume {
  chambre: ChambrePetition;
  numero: number;
  titre: string;
  extrait: string;
  signatures: number | null;
  datePublication: string;
  dateLimite: string | null;
  statutSource: string;
  collecte: 'ouverte' | 'close';
  typeSource: string | null;
  etape: TypeEtapePetition | null;
  etapeDate: string | null;
  suivie: boolean;
  url: string;
  commission: CommissionDePetition | null;
}

export interface EtapePetition {
  type: TypeEtapePetition;
  date: string | null;
  source: 'agenda_an' | 'dossier_an' | 'plateforme';
  rattachement: 'numero' | 'titre_exact' | 'plateforme';
  libelle: string;
  reunion: { uid: string; dateDebut: string; etat: string; commission: CommissionDePetition | null } | null;
  dossier: { uid: string; titre: string } | null;
}

export interface PetitionDetail extends PetitionResume {
  /** Le texte entier : paragraphes séparés par une ligne vide, éléments de liste par un retour simple. */
  texte: string;
  /** Assez long pour que le jeu de données l'ait coupé. */
  texteIncomplet: boolean;
  legislature: number | null;
  commissionSource: string | null;
  decision: string | null;
  decisionDate: string | null;
  updatedAt: string;
  etapes: EtapePetition[];
  releves: { date: string; signatures: number }[];
  /** Personnes citées dans les libellés et la décision, reliées à leur fiche. Absent d'une réponse ancienne. */
  renvois?: RenvoiPersonne[];
}

/** Une personne citée, et sa fiche sur CLAIR (cf. `utils/renvois-personnes` de l'API). */
export interface RenvoiPersonne {
  type: 'lien' | 'nom';
  /** L'URL officielle, ou le nom tel qu'écrit. */
  cle: string;
  chemin: string;
}

export interface PetitionsResponse {
  data: PetitionResume[];
  meta: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean };
}

export interface PetitionsFiltres {
  chambres: { chambre: ChambrePetition; total: number }[];
  etapes: { etape: TypeEtapePetition | 'aucune'; total: number }[];
  suivies: number;
  commissions: { slug: string; nom: string; total: number }[];
}

/** Seuil de signatures d'une pétition suivie (même règle que l'ingestion). */
export const SEUIL_SUIVIE = 10_000;

export const LIBELLE_CHAMBRE: Record<ChambrePetition, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

/** Intitulé d'une étape, pour un badge ou un filtre. */
export const LIBELLE_ETAPE: Record<TypeEtapePetition, string> = {
  rapporteur: 'Rapporteur nommé',
  decision: 'Décision en commission',
  examen: 'Examen en commission',
  rapport: 'Rapport publié',
  classement: 'Classée',
  seuil_atteint: 'Seuil de 100 000 signatures atteint',
  decision_conference: 'Décision de la Conférence des Présidents',
};

/** Ce que dit une étape à venir (agenda d'une réunion qui n'a pas encore eu lieu). */
const LIBELLE_ETAPE_A_VENIR: Partial<Record<TypeEtapePetition, string>> = {
  rapporteur: 'Nomination du rapporteur prévue',
  decision: 'Décision en commission prévue',
  examen: 'Examen en commission prévu',
};

/** Couleur d'une étape : le parcours avance (bleu), aboutit (vert), s'arrête (gris). */
export const COULEUR_ETAPE: Record<TypeEtapePetition, string> = {
  rapporteur: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  decision: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  examen: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  rapport: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  classement: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  seuil_atteint: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  decision_conference: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

/** Date civile `YYYY-MM-DD` d'une date ISO de l'API. */
export function jourIso(iso: string): string {
  return iso.slice(0, 10);
}

/** Date du jour à Paris, `YYYY-MM-DD`. */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);
}

/** Une étape datée après aujourd'hui (Paris) est annoncée, pas accomplie. */
export function estAVenir(date: string | null, aujourdhui: string = aujourdhuiParis()): boolean {
  return date !== null && jourIso(date) > aujourdhui;
}

/** Intitulé d'une étape, au futur si elle est à venir. */
export function libelleEtape(type: TypeEtapePetition, date: string | null, aujourdhui: string = aujourdhuiParis()): string {
  return (estAVenir(date, aujourdhui) && LIBELLE_ETAPE_A_VENIR[type]) || LIBELLE_ETAPE[type];
}

/** « 15 avril 2026 », lu comme une date civile. */
export function dateLongue(iso: string): string {
  return new Date(`${jourIso(iso)}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** « 2 131 368 signatures », « 1 signature », « compteur non publié ». */
export function signaturesEnClair(n: number | null): string {
  if (n === null) return 'compteur non publié';
  return `${n.toLocaleString('fr-FR')} signature${n > 1 ? 's' : ''}`;
}

export function cheminPetition(p: { chambre: ChambrePetition; numero: number }): string {
  return `/petitions/${p.chambre}/${p.numero}`;
}

/** D'où vient une étape, en clair, et le lien qui la prouve. */
export function sourceEtape(e: EtapePetition, urlPetition: string): { libelle: string; href: string; externe: boolean } {
  if (e.source === 'agenda_an' && e.reunion) {
    return { libelle: "Ordre du jour de la réunion de commission", href: `/reunions/${e.reunion.uid}`, externe: false };
  }
  if (e.source === 'dossier_an' && e.dossier) {
    return { libelle: 'Dossier de la procédure « Pétitions »', href: `/dossiers/${e.dossier.uid}`, externe: false };
  }
  return { libelle: 'Page officielle de la pétition', href: urlPetition, externe: true };
}

/** Un morceau de texte, lien ou non ; `interne` : une fiche de CLAIR. */
export interface MorceauDeTexte {
  texte: string;
  href?: string;
  interne?: boolean;
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Pose les renvois de noms sur un morceau de texte sans lien. */
function avecNoms(texte: string, noms: Map<string, string>): MorceauDeTexte[] {
  if (noms.size === 0) return [{ texte }];
  const motif = new RegExp(
    `(?<![\\p{L}])(${[...noms.keys()].sort((a, b) => b.length - a.length).map(echapper).join('|')})(?![\\p{L}])`,
    'gu',
  );
  const morceaux: MorceauDeTexte[] = [];
  let fin = 0;
  for (const m of texte.matchAll(motif)) {
    if (m.index! > fin) morceaux.push({ texte: texte.slice(fin, m.index) });
    morceaux.push({ texte: m[0], href: noms.get(m[0]), interne: true });
    fin = m.index! + m[0].length;
  }
  if (fin < texte.length) morceaux.push({ texte: texte.slice(fin) });
  return morceaux;
}

/**
 * Découpe un texte de la source en morceaux : liens `[texte](url)` (réponse
 * officielle d'une pétition) et adresses nues (« Vidéo : https://… »). Seules
 * les adresses http(s) deviennent des liens.
 */
export function morceauxDeTexte(texte: string, renvois: readonly RenvoiPersonne[] = []): MorceauDeTexte[] {
  const liens = new Map(renvois.filter((r) => r.type === 'lien').map((r) => [r.cle, r.chemin]));
  const noms = new Map(renvois.filter((r) => r.type === 'nom').map((r) => [r.cle, r.chemin]));
  const lien = (libelle: string, url: string): MorceauDeTexte => {
    const chemin = liens.get(url);
    return chemin ? { texte: libelle, href: chemin, interne: true } : { texte: libelle, href: url };
  };
  const morceaux: MorceauDeTexte[] = [];
  let fin = 0;
  for (const m of texte.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+[^\s).,;:!?])/g)) {
    if (m.index! > fin) morceaux.push(...avecNoms(texte.slice(fin, m.index), noms));
    morceaux.push(m[1] ? lien(m[1], m[2]!) : lien(m[3]!, m[3]!));
    fin = m.index! + m[0].length;
  }
  if (fin < texte.length) morceaux.push(...avecNoms(texte.slice(fin), noms));
  return morceaux;
}
