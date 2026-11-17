import { deriveChambre } from './chambre';

/**
 * Les directs, tels que `/api/live-now` les rend.
 *
 * `enCours` dit ce que vaut la source. La page des directs du Sénat ne liste
 * que ce qui est retransmis à l'instant : une entrée y prouve le direct.
 * L'Assemblée ne publie que le catalogue des vidéos récentes, closes comprises :
 * une entrée y dit seulement que la réunion est filmée, et l'heure tranche.
 *
 * `organeRef`, `isoDate`, `order` et `directUrl` gardent leur forme d'avant
 * `videoId`, `libelle` et `enCours` : un onglet ouvert avant un déploiement
 * continue de lire la réponse.
 */
export interface DirectCommission {
  chambre: string;
  directUrl: string;
  /** L'identifiant `id_hash` de la vidéo, celui que porte `reunion.urlVideo`. */
  videoId?: string | null;
  /** AN : l'organe déduit du code vidéo, null si le code n'est pas connu. */
  organeRef: string | null;
  /** Sénat : l'organe tel que la page des directs l'imprime (« A • B » si conjointe). */
  libelle?: string | null;
  enCours?: boolean;
}

export interface DirectSeance {
  chambre: string;
  directUrl: string;
  videoId?: string | null;
  /** Le jour de la séance, à Paris. */
  isoDate: string;
  /** 1re, 2e, 3e séance du jour (AN) ; matin, après-midi, soir (Sénat). */
  order: number;
  enCours?: boolean;
}

export interface LiveNowResponse {
  commissions: DirectCommission[];
  seances: DirectSeance[];
}

export interface ReunionRapprochable {
  id: string;
  type: string;
  dateDebut: string;
  dateFin: string | null;
  urlVideo?: string | null;
  compteRenduRef?: string | null;
  lieu?: string | null;
  commission?: {
    id?: string;
    slug?: string;
    nom?: string | null;
    organeRef?: string | null;
    chambre?: string;
  } | null;
}

/** Sans heure de fin connue, une réunion est réputée durer 4 h. */
export const DUREE_PAR_DEFAUT_MS = 4 * 60 * 60 * 1000;

/** Un direct confirmé peut ouvrir un peu avant l'heure annoncée. */
const AVANCE_MS = 15 * 60 * 1000;

const JOUR_A_PARIS = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' à Paris : c'est le jour que les deux chambres impriment. */
export function jourAParis(date: Date | string | number): string {
  return JOUR_A_PARIS.format(new Date(date));
}

/** `…/video.5994629_6af2f10ab1218.slug` ou `…/direct.19709612_6afb…` → l'id_hash. */
export function videoIdDe(url: string | null | undefined): string | null {
  return url?.match(/(?:video|direct)\.(\d+_[0-9a-f]+)/)?.[1] ?? null;
}

/**
 * Les noms courts que la vidéothèque du Sénat imprime, vers le nom de l'organe.
 * Même table que `VIDEO_SENAT_ALIAS_COMMISSION` dans l'ingestion
 * (`services/ingestion/src/workers/sync.ts`), qui rattache les vidéos closes :
 * les tenir alignées.
 */
const ALIAS_COMMISSION_SENAT: Record<string, string> = {
  'commission des lois':
    "Commission des lois constitutionnelles, de législation, du suffrage universel, du Règlement et d'administration générale",
  'delegation aux droits des femmes':
    "Délégation aux droits des femmes et à l'égalité des chances entre les hommes et les femmes",
  'delegation senatoriale aux outre mer': "Délégation sénatoriale à l'Outre-mer",
  'delegation aux collectivites territoriales':
    'Délégation sénatoriale aux collectivités territoriales et à la décentralisation',
  'delegation aux entreprises': 'Délégation sénatoriale aux entreprises',
};

/** Clé de comparaison d'un nom de commission : sans accent, sans ponctuation. */
export function cleDeCommission(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, ' ')
    .trim()
    .toLowerCase();
}

/** Les organes d'un libellé de direct, « A • B » pour une réunion conjointe. */
function clesDuLibelle(libelle: string): string[] {
  return libelle
    .split('•')
    .map((part) => cleDeCommission(part))
    .filter((cle) => cle.length > 0)
    .map((cle) => {
      const alias = ALIAS_COMMISSION_SENAT[cle];
      return alias ? cleDeCommission(alias) : cle;
    });
}

interface Rapprochement {
  url: string;
  enCours: boolean;
  /** Par la vidéo ou la séance du jour : sûr. Par le nom d'un organe : à borner. */
  parNom: boolean;
}

function rapprocher(
  reunion: ReunionRapprochable,
  chambre: string,
  live: LiveNowResponse,
): Rapprochement | null {
  const commissions = live.commissions.filter((c) => c.chambre === chambre);
  const seances = live.seances.filter((s) => s.chambre === chambre);
  const vers = (d: DirectCommission | DirectSeance, parNom: boolean): Rapprochement => ({
    url: d.directUrl,
    enCours: d.enCours === true,
    parNom,
  });

  // 1. L'identifiant de la vidéo, posé sur la réunion par l'ingestion : exact.
  const videoId = videoIdDe(reunion.urlVideo);
  if (videoId) {
    const parVideo = [...commissions, ...seances].find((d) => d.videoId === videoId);
    if (parVideo) return vers(parVideo, false);
  }

  // 2. La séance du jour. La plus avancée l'emporte : le soir sur l'après-midi.
  if (reunion.type === 'seance') {
    const jour = jourAParis(reunion.dateDebut);
    const seance = seances
      .filter((s) => s.isoDate === jour)
      .sort((a, b) => b.order - a.order)[0];
    return seance ? vers(seance, false) : null;
  }

  // 3. La commission : par organe à l'AN, par nom au Sénat.
  const organeRef = reunion.commission?.organeRef;
  const parOrgane = organeRef ? commissions.find((c) => c.organeRef === organeRef) : undefined;
  if (parOrgane) return vers(parOrgane, false);

  const nom = reunion.commission?.nom;
  if (nom) {
    const cle = cleDeCommission(nom);
    const parNom = commissions.find((c) => c.libelle && clesDuLibelle(c.libelle).includes(cle));
    if (parNom) return vers(parNom, true);
  }
  return null;
}

/** Les réunions d'un même organe, un même jour : un direct est à la dernière commencée. */
function groupeDe(reunion: ReunionRapprochable, chambre: string): string {
  const jour = jourAParis(reunion.dateDebut);
  if (reunion.type === 'seance') return `seance|${chambre}|${jour}`;
  const c = reunion.commission;
  return `commission|${chambre}|${c?.slug ?? c?.id ?? c?.nom ?? reunion.id}|${jour}`;
}

/**
 * Les réunions en direct, et le lien de leur direct.
 *
 * `reunions` est la liste d'UNE journée (agenda, accueil) : un direct revient à
 * la réunion de son organe commencée le plus récemment, ce qui demande de voir
 * les autres.
 *
 * - Direct confirmé (Sénat), rapproché par la vidéo ou par la séance du jour :
 *   pas d'heure de fin. Le Sénat n'en annonce jamais, et une séance de 14 h 30
 *   court souvent jusqu'au soir ; la fenêtre de 4 h éteignait le badge à 18 h 30.
 * - Direct confirmé rapproché par le seul nom de la commission : la fenêtre de
 *   la réunion borne en plus, faute de preuve que c'est bien elle qu'on filme.
 * - Direct non confirmé (AN) : la fenêtre de la réunion décide.
 */
export function directsDesReunions(
  reunions: ReunionRapprochable[],
  live: LiveNowResponse | undefined,
  now: number,
): Map<string, string> {
  const directs = new Map<string, string>();
  if (!live) return directs;

  const debutsParGroupe = new Map<string, number[]>();
  for (const r of reunions) {
    const chambre = deriveChambre(r);
    if (!chambre) continue;
    const g = groupeDe(r, chambre);
    debutsParGroupe.set(g, [...(debutsParGroupe.get(g) ?? []), new Date(r.dateDebut).getTime()]);
  }

  for (const r of reunions) {
    const chambre = deriveChambre(r);
    if (!chambre) continue;
    const m = rapprocher(r, chambre, live);
    if (!m) continue;

    const debut = new Date(r.dateDebut).getTime();
    const fin = r.dateFin ? new Date(r.dateFin).getTime() : debut + DUREE_PAR_DEFAUT_MS;

    if (!m.enCours) {
      if (now >= debut && now <= fin) directs.set(r.id, m.url);
      continue;
    }

    if (now < debut - AVANCE_MS) continue;
    if (m.parNom && now > fin) continue;
    // Une réunion du même organe a commencé depuis : le direct est le sien.
    const relayee = (debutsParGroupe.get(groupeDe(r, chambre)) ?? []).some(
      (t) => t > debut && t <= now + AVANCE_MS,
    );
    if (relayee) continue;
    directs.set(r.id, m.url);
  }

  return directs;
}

/**
 * La réunion est-elle en cours, à l'heure seule ? Sert au fond de la carte et à
 * l'accueil ; le badge, lui, attend `directsDesReunions`.
 */
export function estEnCours(
  reunion: Pick<ReunionRapprochable, 'dateDebut' | 'dateFin'>,
  now: number,
): boolean {
  const debut = new Date(reunion.dateDebut).getTime();
  const fin = reunion.dateFin ? new Date(reunion.dateFin).getTime() : debut + DUREE_PAR_DEFAUT_MS;
  return now >= debut && now <= fin;
}
