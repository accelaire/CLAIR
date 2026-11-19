/**
 * Ce que l'agenda dit d'une réunion : son titre, sa nature, son horaire, son
 * ordre du jour. Partagé par l'agenda, l'accueil et la page d'une réunion, pour
 * qu'une même réunion se lise de la même façon partout.
 */
import { DUREE_PAR_DEFAUT_MS, jourAParis } from './live-url';

export interface ReunionAgenda {
  id: string;
  type: string;
  dateDebut: string;
  dateFin: string | null;
  etat?: string | null;
  odjResume?: string | null;
  commission?: {
    nom?: string | null;
    type?: string | null;
    chambre?: string | null;
  } | null;
}

const HEURE_A_PARIS = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * L'heure à Paris, quel que soit le fuseau du lecteur : l'agenda est celui du
 * Parlement, et « 14:30 » n'a de sens qu'à l'heure de l'hémicycle.
 */
export function heureAParis(iso: string): string {
  return HEURE_A_PARIS.format(new Date(iso));
}

/** Minutes écoulées depuis minuit à Paris (0-1439). */
export function minutesAParis(iso: string): number {
  const [h, m] = heureAParis(iso).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Les jours (à Paris) d'une plage, bornes incluses. */
function joursEntre(debut: string, fin: string): string[] {
  const jours: string[] = [];
  const curseur = new Date(`${debut}T12:00:00Z`);
  const borne = new Date(`${fin}T12:00:00Z`);
  while (curseur <= borne && jours.length < 62) {
    jours.push(curseur.toISOString().slice(0, 10));
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
}

/**
 * Un déplacement, une mission à l'étranger : l'AN les date de minuit à 23 h 59
 * et les fait courir sur plusieurs jours (« du 20 au 23 »). Afficher « 00:00 »
 * laissait croire à une réunion en pleine nuit.
 *
 * Commencer à minuit est le critère : une séance de 21 h 30 qui finit après
 * minuit, ou une audition qui reprend le lendemain matin, n'en sont pas.
 */
export function estSurPlusieursJours(r: Pick<ReunionAgenda, 'dateDebut' | 'dateFin'>): boolean {
  if (!r.dateFin) return false;
  return minutesAParis(r.dateDebut) === 0 && jourAParis(r.dateFin) !== jourAParis(r.dateDebut);
}

export function estSansHoraire(r: Pick<ReunionAgenda, 'dateDebut' | 'dateFin'>): boolean {
  return estSurPlusieursJours(r) || (minutesAParis(r.dateDebut) === 0 && !r.dateFin);
}

/** Les jours (à Paris) où la réunion figure à l'agenda. */
export function joursDeLaReunion(r: Pick<ReunionAgenda, 'dateDebut' | 'dateFin'>): string[] {
  const debut = jourAParis(r.dateDebut);
  if (!estSurPlusieursJours(r)) return [debut];
  return joursEntre(debut, jourAParis(r.dateFin!));
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function jourCourt(jour: string): string {
  const [, mois, j] = jour.split('-').map(Number);
  return `${j} ${MOIS_COURTS[(mois ?? 1) - 1]}`;
}

/** « 14:30 », « 14:30 – 16:00 », « Journée » ou « 20 – 23 nov. ». */
export function horaireDeLaReunion(r: Pick<ReunionAgenda, 'dateDebut' | 'dateFin'>): {
  debut: string;
  fin: string | null;
} {
  if (estSurPlusieursJours(r)) {
    return { debut: jourCourt(jourAParis(r.dateDebut)), fin: jourCourt(jourAParis(r.dateFin!)) };
  }
  if (estSansHoraire(r)) return { debut: 'Journée', fin: null };
  if (!r.dateFin) return { debut: heureAParis(r.dateDebut), fin: null };
  // Fin un autre jour : l'heure suffit pour une séance qui passe minuit, la
  // date est plus juste pour une réunion qui reprend le lendemain.
  const jourFin = jourAParis(r.dateFin);
  const longue = new Date(r.dateFin).getTime() - new Date(r.dateDebut).getTime() > 12 * 3_600_000;
  return {
    debut: heureAParis(r.dateDebut),
    fin: jourFin !== jourAParis(r.dateDebut) && longue ? jourCourt(jourFin) : heureAParis(r.dateFin),
  };
}

export function estAnnulee(r: Pick<ReunionAgenda, 'etat'>): boolean {
  return r.etat === 'annule';
}

export function estSeance(r: Pick<ReunionAgenda, 'type'>): boolean {
  return r.type === 'seance';
}

/**
 * Le titre d'une réunion. Une séance publique est rattachée à l'organe
 * « Assemblée nationale de la 17ème législature » ou « Sénat ( 5ème République ) » :
 * ce nom ne dit rien au lecteur, la chambre est déjà donnée à côté.
 *
 * JAMAIS `nomCourt` : à l'AN, c'est le code de l'organe (« CION_LOIS », « AN »).
 */
export function titreDeReunion(r: Pick<ReunionAgenda, 'type' | 'commission'>): string {
  if (estSeance(r)) return 'Séance publique';
  if (r.commission?.nom) return r.commission.nom;
  if (r.type === 'initiative_parlementaire') return "Réunion d'un groupe d'études";
  return 'Réunion de commission';
}

const NATURE_PAR_TYPE: Record<string, string> = {
  hemicycle: 'Séance publique',
  permanente: 'Commission permanente',
  enquete: "Commission d'enquête",
  mission_info: "Mission d'information",
  delegation: 'Délégation',
  office: 'Office parlementaire',
  groupe_etudes: "Groupe d'études",
  groupe_amitie: "Groupe d'amitié",
  mixte_paritaire: 'Commission mixte paritaire',
  assemblee_internationale: 'Délégation internationale',
  speciale: 'Commission spéciale',
};

/** La nature de l'organe, pour la pastille : « Commission d'enquête », « Groupe d'amitié »… */
export function natureDeReunion(r: Pick<ReunionAgenda, 'type' | 'commission'>): string {
  if (estSeance(r)) return 'Séance publique';
  const type = r.commission?.type;
  if (type && NATURE_PAR_TYPE[type]) return NATURE_PAR_TYPE[type]!;
  if (r.type === 'initiative_parlementaire') return "Groupe d'études";
  return 'Commission';
}

/**
 * Les points de l'ordre du jour. Les sources les livrent en un bloc : retours
 * chariot de l'AN (« - audition…\r- examen… »), « | » entre deux points du Sénat,
 * puces et tirets en tête de ligne.
 */
export function pointsDeLOrdreDuJour(odj: string | null | undefined): string[] {
  if (!odj) return [];
  return odj
    .split(/\r\n|\r|\n|\s\|\s/)
    .map((p) => p.replace(/^[\s\-–—•·.*]+/, '').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 1)
    .map((p) => p.charAt(0).toLocaleUpperCase('fr-FR') + p.slice(1));
}

export type Moment = 'matin' | 'apres-midi' | 'soir';

export const LIBELLE_MOMENT: Record<Moment, string> = {
  matin: 'Matin',
  'apres-midi': 'Après-midi',
  soir: 'Soir',
};

/** Matin avant 12 h, soir à partir de 19 h, à Paris. */
export function momentDeLaReunion(r: Pick<ReunionAgenda, 'dateDebut'>): Moment {
  const minutes = minutesAParis(r.dateDebut);
  if (minutes < 12 * 60) return 'matin';
  if (minutes < 19 * 60) return 'apres-midi';
  return 'soir';
}

/** Fin réelle ou présumée (4 h sans heure de fin). */
export function finPresumee(r: Pick<ReunionAgenda, 'dateDebut' | 'dateFin'>): number {
  const debut = new Date(r.dateDebut).getTime();
  return r.dateFin ? new Date(r.dateFin).getTime() : debut + DUREE_PAR_DEFAUT_MS;
}

/**
 * « 2e séance » : le rang d'une séance de l'AN dans sa journée, quand il y en a
 * plusieurs. Le Sénat ne numérote pas ses séances.
 */
export function rangsDesSeances(reunions: ReunionAgenda[]): Map<string, string> {
  const rangs = new Map<string, string>();
  const parJour = new Map<string, ReunionAgenda[]>();
  for (const r of reunions) {
    if (!estSeance(r) || estAnnulee(r) || r.commission?.chambre !== 'assemblee') continue;
    const jour = jourAParis(r.dateDebut);
    parJour.set(jour, [...(parJour.get(jour) ?? []), r]);
  }
  for (const seances of parJour.values()) {
    if (seances.length < 2) continue;
    seances
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
      .forEach((s, i) => rangs.set(s.id, i === 0 ? '1re séance' : `${i + 1}e séance`));
  }
  return rangs;
}

/**
 * Les réunions rangées par jour À PARIS. L'API range par jour UTC : une
 * réunion de 0 h 30 tombait la veille. Une mission de plusieurs jours figure à
 * chacun de ses jours.
 */
export function reunionsParJour<T extends ReunionAgenda>(reunions: T[]): Record<string, T[]> {
  const parJour: Record<string, T[]> = {};
  const vues = new Set<string>();
  for (const r of reunions) {
    if (vues.has(r.id)) continue;
    vues.add(r.id);
    for (const jour of joursDeLaReunion(r)) (parJour[jour] ??= []).push(r);
  }
  for (const liste of Object.values(parJour)) {
    liste.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  }
  return parJour;
}
