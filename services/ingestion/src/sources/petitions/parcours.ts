// =============================================================================
// Pétitions citoyennes : lire le parcours dans les sources de première main
// =============================================================================
//
// Le jeu de données dit qui signe, pas ce que la chambre fait d'une pétition.
// Ce module lit les étapes là où elles sont écrites :
//
//  - l'ordre du jour des réunions de commission de l'AN, qui trace chaque pas
//    de la procédure de l'article 148 du Règlement (rapporteur nommé, décision
//    de classer ou d'examiner, examen), y compris à venir ;
//  - les dossiers législatifs de la procédure « Pétitions » (code 16), ouverts
//    quand une commission rend un rapport ;
//  - la réponse affichée sur la page officielle de la pétition (décision de la
//    commission à l'AN, de la Conférence des Présidents au Sénat).
//
// RATTACHEMENT. Par numéro explicite, lié au mot « pétition » dans le même
// point de l'ordre du jour, et jamais par inclusion de libellés : c'est un
// `includes` qui avait mis 37,9 % des amendements AN au mauvais député. Seule
// exception, quand l'agenda ne donne que le titre (n° 5820, CNews) : le titre
// entre guillemets doit être IDENTIQUE, sous `formeComparable`, à celui d'une
// seule pétition de la même commission, publiée au plus tard le jour de la
// réunion (quatre copies de la n° 5820 ont été publiées après). Le worker applique en plus la garde de
// commission aux numéros : mesuré le 22/11/2026, une lecture trop large donnait
// 2 faux positifs sur 14 (un « n° » appartenant à un autre texte).
//
// Module pur : aucun accès réseau ni base.
// =============================================================================

import * as cheerio from 'cheerio';
import { nettoyerTexte } from './normalisation';

export type TypeEtapeAgenda = 'rapporteur' | 'decision' | 'examen';

export type TypeEtape =
  | TypeEtapeAgenda
  | 'rapport'
  | 'classement'
  | 'seuil_atteint'
  | 'decision_conference';

/** Étapes qui font d'une pétition une pétition « suivie ». Un classement seul n'en est pas une : c'est le sort de 1 700 pétitions classées d'office. */
export const ETAPES_INSTITUTIONNELLES: ReadonlySet<TypeEtape> = new Set<TypeEtape>([
  'rapporteur', 'decision', 'examen', 'rapport', 'seuil_atteint', 'decision_conference',
]);

/** Ordre d'une même journée : l'étape la plus avancée passe en dernier. */
const RANG: Record<TypeEtape, number> = {
  seuil_atteint: 0,
  rapporteur: 1,
  decision: 2,
  classement: 3,
  examen: 4,
  rapport: 5,
  decision_conference: 6,
};

export interface PointOdj {
  type: TypeEtapeAgenda;
  /** Numéros explicitement liés au mot « pétition » dans ce point */
  numeros: number[];
  /** Titres entre guillemets donnés sans numéro, tels qu'écrits */
  titres: string[];
  /** Le point de l'ordre du jour, nettoyé */
  libelle: string;
}

// « pétition », « pétitions », et la coquille « pétitition » relevée le 08/09/2025.
const MOT_PETITION = /p[ée]ti(?:ti)+ons?\b/i;

/**
 * Découpe un ordre du jour en points. Les points sont séparés par des retours
 * à la ligne (`\r` ou `\n` selon la source) ; quelques-uns sont mis bout à bout
 * sur une ligne, séparés par « ; » puis un tiret.
 */
export function decouperOdj(odj: string): string[] {
  return odj
    .split(/[\r\n]+|;\s*(?=[-–—•])/)
    .map((p) => p.replace(/^[\s\-–—•\t]+/, '').trim())
    .filter((p) => p.length > 0);
}

function typeDuPoint(point: string): TypeEtapeAgenda | null {
  const p = point.toLowerCase();
  // Le verbe de tête d'abord : « Nomination d'un rapporteur sur la décision de
  // classement ou d'examen » est une nomination, pas une décision.
  if (/^(nomination|désignation)/.test(p)) return 'rapporteur';
  if (/^examen\b/.test(p) && !/classement/.test(p)) return 'examen';
  if (/^(décision|présentation)/.test(p) || /classement ou (de leur |son |l’|l')?examen|vote sur son classement|décision sur leur classement/.test(p)) {
    return 'decision';
  }
  return null;
}

/**
 * Les points de l'ordre du jour qui font avancer une pétition nommée, par son
 * numéro ou, à défaut, par son titre exact. Un point qui parle « des pétitions
 * renvoyées à la commission » sans en nommer aucune ne rattache rien.
 */
export function lireOdj(odj: string): PointOdj[] {
  const points: PointOdj[] = [];
  for (const brut of decouperOdj(odj)) {
    const premier = brut.search(MOT_PETITION);
    if (premier < 0) continue;
    const type = typeDuPoint(brut);
    if (!type) continue;

    const suite = brut.slice(premier);
    const numeros = new Set<number>();

    // « pétition n° 4753 », « pétition n°5158 » ; et pour un pluriel, la liste
    // qui suit jusqu'à la parenthèse fermante : « pétitions n° 2760 pour…,
    // n° 3021 pour…, et n° 4583 pour… ) ».
    for (const m of suite.matchAll(/p[ée]ti(?:ti)+on(s?)\s*(?:n[°o]|numéro)\s*(\d{1,5})\b/gi)) {
      numeros.add(Number(m[2]));
      if (m[1]) {
        const reste = suite.slice((m.index ?? 0) + m[0].length);
        const liste = reste.slice(0, reste.includes(')') ? reste.indexOf(')') : undefined);
        for (const n of liste.matchAll(/n[°o]\s*(\d{1,5})\b/gi)) numeros.add(Number(n[1]));
      }
    }

    // « la pétition intitulée « … » (n° 3014) », « intitulées « A » (n° 3014) et « B » (n° 3092) ».
    for (const m of suite.matchAll(/«([^«»]{2,400})»\s*\(\s*n[°o]\s*(\d{1,5})\s*\)/g)) {
      numeros.add(Number(m[2]));
    }

    // Titre sans numéro : « pétition « … » », « (pétitition « … ») »,
    // « pétition intitulée « … » » non suivi d'un numéro.
    const titres: string[] = [];
    for (const m of suite.matchAll(/p[ée]ti(?:ti)+on\s*(?:intitulée\s*)?«\s*([^«»]{2,400}?)\s*»(?!\s*\(\s*n[°o])/gi)) {
      titres.push(nettoyerTexte(m[1] ?? ''));
    }

    if (numeros.size === 0 && titres.length === 0) continue;
    points.push({ type, numeros: [...numeros], titres, libelle: nettoyerTexte(brut) });
  }
  return points;
}

/** Le numéro de pétition qu'un dossier de la procédure « Pétitions » porte dans son titre. */
export function numeroDuDossier(titre: string): number | null {
  const m = /p[ée]tition\s*n[°o]\s*(\d{1,5})\b/i.exec(titre);
  return m ? Number(m[1]) : null;
}

/**
 * Date du rapport d'un dossier « Pétitions » : l'acte de dépôt du rapport
 * (`…-RAPPORT`), sinon le dernier acte daté. Parcours récursif des
 * `actesLegislatifs` du JSON source de l'AN.
 */
export function dateDuDossier(sourceData: unknown): Date | null {
  const rapports: string[] = [];
  const toutes: string[] = [];
  const visiter = (noeud: unknown): void => {
    if (Array.isArray(noeud)) {
      noeud.forEach(visiter);
      return;
    }
    if (!noeud || typeof noeud !== 'object') return;
    const o = noeud as Record<string, unknown>;
    if (typeof o.dateActe === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.dateActe)) {
      toutes.push(o.dateActe.slice(0, 10));
      if (typeof o.codeActe === 'string' && /RAPPORT$/.test(o.codeActe)) rapports.push(o.dateActe.slice(0, 10));
    }
    for (const v of Object.values(o)) visiter(v);
  };
  visiter(sourceData);
  const choix = (rapports.length ? rapports : toutes).sort().at(-1);
  return choix ? new Date(`${choix}T00:00:00Z`) : null;
}

const FORMAT_JOUR_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * Date civile à Paris d'un instant. Les réunions sont stockées en UTC : une
 * réunion à 0 h 13 à Paris tombe la veille en UTC.
 */
export function jourParis(instant: Date): Date {
  return new Date(`${FORMAT_JOUR_PARIS.format(instant)}T00:00:00Z`);
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Première date écrite en toutes lettres (« 23 novembre 2021 », « 1er juin 2023 »). */
export function dateEnLettres(texte: string): Date | null {
  const m = /\b(\d{1,2})(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/i.exec(texte);
  if (!m) return null;
  const mois = (m[2] ?? '').toLowerCase().replace('fevrier', 'février').replace('aout', 'août').replace('decembre', 'décembre');
  const d = new Date(Date.UTC(Number(m[3]), MOIS.indexOf(mois), Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ReponseOfficielle {
  /** Intitulé du bloc (« Cette pétition a été classée par la commission : ») */
  titre: string | null;
  /**
   * Texte de la réponse : blocs séparés par une ligne vide, éléments de liste
   * par un retour simple (préfixés « – »), liens au format `[texte](url)`.
   */
  texte: string | null;
  /** Date de la décision : celle du bloc (AN), sinon la première écrite en lettres */
  date: Date | null;
}

/** Taille maximale gardée du texte d'une réponse (le Sénat y met des comptes rendus entiers). */
const LONGUEUR_REPONSE = 6000;

/** Texte d'un nœud, ses liens gardés en `[texte](url)`, ses images ignorées. */
function texteAvecLiens($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0], base: string): string {
  let sortie = '';
  $(el).contents().each((_, n) => {
    if (n.type === 'text') {
      sortie += (n as unknown as { data: string }).data;
      return;
    }
    if (n.type !== 'tag') return;
    const tag = (n as unknown as { tagName: string }).tagName.toLowerCase();
    if (tag === 'br') {
      sortie += '\n';
    } else if (tag === 'a') {
      const libelle = nettoyerTexte($(n).text());
      let href: string | null = null;
      try {
        const u = new URL($(n).attr('href') ?? '', base);
        if (u.protocol === 'http:' || u.protocol === 'https:') href = u.href;
      } catch {
        href = null;
      }
      if (!libelle) return;
      sortie += href && libelle !== href ? `[${libelle.replace(/[[\]]/g, '')}](${href})` : libelle;
    } else if (tag !== 'img' && tag !== 'script' && tag !== 'style') {
      sortie += texteAvecLiens($, n as Parameters<cheerio.CheerioAPI>[0], base);
    }
  });
  return sortie;
}

/**
 * La réponse affichée sur la page d'une pétition (bloc `.initiative-answer`,
 * commun aux deux plateformes Decidim). Null s'il n'y en a pas.
 *
 * Les liens restent des liens : « Lire le communiqué de presse », « Vidéo de
 * la réunion » ou « Synthèse du rapport » n'ont de sens qu'avec leur cible.
 * Images (le Sénat y colle des photos en base64) et séparateurs « **** »
 * retirés. `base` résout les liens relatifs.
 */
export function lireReponseOfficielle(html: string, base = 'https://petitions.senat.fr/'): ReponseOfficielle | null {
  const $ = cheerio.load(html);
  const bloc = $('.initiative-answer').first();
  if (bloc.length === 0) return null;

  const titre = nettoyerTexte(bloc.find('h5').first().text()) || null;
  const dateBloc = /(\d{2})\/(\d{2})\/(\d{4})/.exec(bloc.find('span').first().text());

  // Un bloc par <p> ou <li> qui n'en contient pas d'autre (il serait lu deux
  // fois) ; les éléments de liste qui se suivent restent sur des lignes voisines.
  const blocs: { texte: string; liste: boolean }[] = [];
  bloc.find('p, li').each((_, el) => {
    const n = $(el);
    if (n.find('p, li').length > 0) return;
    const t = texteAvecLiens($, el, base)
      .split('\n')
      .map((l) => nettoyerTexte(l))
      .filter((l) => l && !/^[*\-_=]{3,}$/.test(l))
      .join('\n');
    if (t) blocs.push({ texte: t, liste: el.tagName.toLowerCase() === 'li' });
  });

  let texte = '';
  for (const [i, b] of blocs.entries()) {
    const morceau = b.liste ? `– ${b.texte}` : b.texte;
    const separateur = i === 0 ? '' : b.liste && blocs[i - 1]!.liste ? '\n' : '\n\n';
    // Coupé à la fin d'un bloc, jamais au milieu d'un lien.
    if (texte.length + separateur.length + morceau.length > LONGUEUR_REPONSE) {
      texte += `${separateur}…`;
      break;
    }
    texte += separateur + morceau;
  }

  const date = dateBloc
    ? new Date(Date.UTC(Number(dateBloc[3]), Number(dateBloc[2]) - 1, Number(dateBloc[1])))
    : texte ? dateEnLettres(texte) : null;

  if (!titre && !texte) return null;
  return { titre, texte: texte || null, date };
}

export interface EtapeCalculee {
  type: TypeEtape;
  date: Date | null;
}

/**
 * La dernière étape du parcours : la plus récente, et dans une même journée la
 * plus avancée. Une étape sans date passe avant les étapes datées.
 */
export function derniereEtape<E extends EtapeCalculee>(etapes: readonly E[]): E | null {
  if (etapes.length === 0) return null;
  const cle = (e: E) => [e.date ? e.date.getTime() : -Infinity, RANG[e.type]] as const;
  return [...etapes].sort((a, b) => {
    const [da, ra] = cle(a);
    const [db, rb] = cle(b);
    return da - db || ra - rb;
  }).at(-1) ?? null;
}

/** Indexable : au moins `seuil` signatures, ou au moins une étape institutionnelle. */
export function estSuivie(signatures: number | null, etapes: readonly { type: TypeEtape }[], seuil: number): boolean {
  return (signatures ?? 0) >= seuil || etapes.some((e) => ETAPES_INSTITUTIONNELLES.has(e.type));
}
