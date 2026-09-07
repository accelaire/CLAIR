// =============================================================================
// Parser du compte rendu de séance AN (« syceron brut »)
// Source: https://data.assemblee-nationale.fr/static/openData/repository/{legislature}/vp/syceronbrut/syseron.xml.zip
// =============================================================================
//
// Ce schéma remplace celui de DILA, qui ne publie plus rien depuis janvier 2026
// et ne portait de toute façon aucun rattachement exploitable : le lien entre
// une prise de parole et l'amendement discuté n'y existait que dans le texte
// libre du compte rendu.
//
// Ici chaque <point> porte l'article (`art`) et le texte (`bibard`) en clair,
// chaque <paragraphe> un `code_grammaire` typé et l'identifiant de l'orateur
// (`id_acteur`), et les mises aux voix sont explicites :
//
//   SCRUT_PUB_ADT_1_2  valeur=" 2407"  « Je mets aux voix l'amendement no 2407. »
//   SCRUT_PUB_ADT_1_4                  « Nombre de votants 125 … »
//   SCRUT_ART_PUB_1_6  valeur=" 15"    « Je mets aux voix l'article 15. »
//
// Les <point> sont IMBRIQUÉS (nivpoint 1 à 4) : un paragraphe hérite de
// l'article du plus proche point englobant qui en déclare un. Un parcours à
// plat perdrait ce rattachement.

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';

// =============================================================================
// TYPES
// =============================================================================

/** Une prise de parole rattachée à son contexte de discussion. */
export interface PriseDeParoleSyceron {
  /** `id_syceron` du paragraphe : clé d'idempotence entre deux ingestions. */
  sourceUid: string;
  /** `ordre_absolu_seance` : ordre total et stable dans la séance. */
  ordreAbsolu: number;
  codeGrammaire: string;
  /** `PA123456`, tiré de `id_acteur` — plus aucun rapprochement par le nom. */
  orateurRef: string | null;
  orateurNom: string;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  contenu: string;
  /** Article en discussion : `15`, `Après 14`, `Avant 16`. */
  articleVise: string | null;
  /** Numéros d'amendement nommés par ce paragraphe (souvent vide). */
  amendementsVises: string[];
  /** Numéro du texte en discussion, tiré de `bibard`. */
  texteNumero: string | null;
  /** Vrai pour la mécanique de séance (« La parole est à… »), à ne pas afficher. */
  estPresidence: boolean;
}

/** Une mise aux voix annoncée au perchoir : la charnière vers nos scrutins. */
export interface VoteAnnonceSyceron {
  ordreAbsolu: number;
  cible: 'article' | 'amendement';
  /** Numéro d'article, ou numéros d'amendements mis aux voix ensemble. */
  numeros: string[];
  articleVise: string | null;
  texteNumero: string | null;
  /** Chiffres proclamés, quand le scrutin est public. Sert de contre-épreuve. */
  resultat: { votants: number; exprimes: number; pour: number; contre: number } | null;
}

export interface SeanceSyceron {
  /** `CRSANR5L17S2025O1N214`. */
  uid: string;
  /** `RUANR5L17S2025IDS29400`, la réunion correspondante. */
  seanceRef: string | null;
  legislature: number;
  date: Date;
  prises: PriseDeParoleSyceron[];
  votes: VoteAnnonceSyceron[];
}

// =============================================================================
// CODES DE GRAMMAIRE
// =============================================================================

/** Annonce d'une mise aux voix : « Je mets aux voix… ». */
const ANNONCE_VOTE: Record<string, 'article' | 'amendement'> = {
  SCRUT_ART_PUB_1_6: 'article',
  SCRUT_PUB_ADT_1_2: 'amendement',
  SCRUT_ADTS_1_2: 'amendement',
};

/** Proclamation chiffrée du résultat, qui suit l'annonce de quelques rangs. */
const RESULTAT_VOTE = new Set(['SCRUT_ART_PUB_1_8', 'SCRUT_PUB_ADT_1_4', 'SCRUT_ADTS_1_4']);

/** Distance maximale entre l'annonce et la proclamation, en paragraphes. */
const PORTEE_RESULTAT = 4;

// =============================================================================
// NORMALISATION
// =============================================================================

/**
 * `" 15"` → `"15"`, `"Après_ 9"` → `"Après 9"`.
 * L'AN sépare le rang de l'article par un tiret bas.
 */
export function normaliserArticle(brut: string | undefined): string | null {
  if (!brut) return null;
  const propre = brut.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return propre.length > 0 ? propre : null;
}

/**
 * Numéros d'amendement portés par `valeur`.
 *
 * `" 2407"` → `['2407']`
 * `" 74, 1300 et 2598"` → `['74', '1300', '2598']`
 * `" 2066 rectifié"` → `['2066']` — la mention de rectification ne fait pas
 * partie du numéro, exactement comme `normalizeNumero()` côté amendements.
 */
export function numerosAmendement(brut: string | undefined): string[] {
  if (!brut) return [];
  return [...brut.matchAll(/\d+/g)].map((m) => m[0]);
}

/**
 * Numéro du texte en discussion, tiré de `bibard`.
 * `" (n[[o]] 1364)"` → `"1364"`. Le `[[o]]` est l'exposant « o » de « n° ».
 */
export function numeroTexte(brut: string | undefined): string | null {
  if (!brut) return null;
  const m = brut.match(/\d+/);
  return m ? m[0] : null;
}

/**
 * `20250523213000000` → 23 mai 2025, 21h30.
 * Les 3 derniers chiffres sont des millisecondes toujours nulles.
 */
export function dateDeSeance(brut: string | undefined): Date | null {
  if (!brut) return null;
  const m = brut.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, a, mo, j, h, mi, s] = m;
  const date = new Date(
    Date.UTC(Number(a), Number(mo) - 1, Number(j), Number(h), Number(mi), Number(s)),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Découpe `"M. Yannick Monnet"` en prénom et nom.
 * La civilité n'appartient pas au nom, et l'AN la préfixe systématiquement.
 */
export function decouperNom(brut: string): { prenom: string | null; nom: string } {
  const sansCivilite = brut.replace(/^(M\.|MM\.|Mme|Mmes)\s+/u, '').trim();
  const parts = sansCivilite.split(/\s+/);
  if (parts.length < 2) return { prenom: null, nom: sansCivilite };
  return { prenom: parts[0] ?? null, nom: parts.slice(1).join(' ') };
}

/** Chiffres proclamés au perchoir, dans l'ordre fixe du compte rendu. */
export function resultatProclame(
  texte: string,
): { votants: number; exprimes: number; pour: number; contre: number } | null {
  const m = texte.match(
    /Nombre de votants\s*:?\s*(\d+).*?suffrages exprim\S*\s*:?\s*(\d+).*?adoption\s*:?\s*(\d+).*?[Cc]ontre\s*:?\s*(\d+)/s,
  );
  if (!m) return null;
  return {
    votants: Number(m[1]),
    exprimes: Number(m[2]),
    pour: Number(m[3]),
    contre: Number(m[4]),
  };
}

// =============================================================================
// PARSER
// =============================================================================

/** Contexte hérité du plus proche <point> englobant qui le déclare. */
interface ContextePoint {
  articleVise: string | null;
  texteNumero: string | null;
}

/**
 * Transforme un compte rendu de séance en prises de parole et mises aux voix.
 *
 * Retourne `null` si le document n'est pas exploitable (métadonnées absentes),
 * plutôt que de lever : une séance illisible ne doit pas interrompre la
 * moisson des 600 autres.
 */
export function parseCompteRendu(xml: string): SeanceSyceron | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(xml, { xmlMode: true });
  } catch (error) {
    logger.warn({ error: errorMessage(error) }, 'Compte rendu illisible');
    return null;
  }

  const uid = $('compteRendu > uid').first().text().trim();
  const date = dateDeSeance($('metadonnees > dateSeance').first().text().trim());
  const legislature = Number($('metadonnees > legislature').first().text().trim());

  if (!uid || !date || !Number.isFinite(legislature)) {
    logger.warn({ uid, legislature }, 'Compte rendu sans métadonnées exploitables');
    return null;
  }

  const prises: PriseDeParoleSyceron[] = [];
  const votes: VoteAnnonceSyceron[] = [];

  const contenu = $('compteRendu > contenu').first();
  if (contenu.length === 0) return null;

  // Parcours en profondeur, dans l'ordre du document, en empilant le contexte
  // porté par chaque <point>. Les points étant imbriqués sur quatre niveaux,
  // c'est cet héritage qui rattache un paragraphe à son article.
  const parcourir = (noeud: Element, herite: ContextePoint): void => {
    for (const enfant of noeud.children) {
      if (!estElement(enfant)) continue;

      if (enfant.name === 'point') {
        const propre: ContextePoint = {
          articleVise: normaliserArticle(enfant.attribs['art']) ?? herite.articleVise,
          texteNumero: numeroTexte(enfant.attribs['bibard']) ?? herite.texteNumero,
        };
        parcourir(enfant, propre);
        continue;
      }

      if (enfant.name === 'paragraphe') {
        collecter($, enfant, herite, prises, votes);
        continue;
      }

      parcourir(enfant, herite);
    }
  };

  parcourir(contenu.get(0) as Element, { articleVise: null, texteNumero: null });

  rattacherResultats(prises, votes);

  return {
    uid,
    seanceRef: $('compteRendu > seanceRef').first().text().trim() || null,
    legislature,
    date,
    prises,
    votes,
  };
}

function estElement(noeud: AnyNode): noeud is Element {
  return noeud.type === 'tag';
}

function collecter(
  $: cheerio.CheerioAPI,
  paragraphe: Element,
  contexte: ContextePoint,
  prises: PriseDeParoleSyceron[],
  votes: VoteAnnonceSyceron[],
): void {
  const attribs = paragraphe.attribs;
  const codeGrammaire = attribs['code_grammaire'] ?? '';
  const ordreAbsolu = Number(attribs['ordre_absolu_seance']);
  const valeur = attribs['valeur'];

  const noeud = $(paragraphe);
  const contenu = nettoyer(noeud.children('texte').text());

  const orateur = noeud.children('orateurs').children('orateur').first();
  const nomBrut = orateur.children('nom').text().trim();
  const qualite = orateur.children('qualite').text().trim();
  const idActeur = attribs['id_acteur'];

  const cibleVote = ANNONCE_VOTE[codeGrammaire];
  if (cibleVote && Number.isFinite(ordreAbsolu)) {
    const numeros =
      cibleVote === 'article'
        ? [normaliserArticle(valeur) ?? ''].filter((n) => n.length > 0)
        : numerosAmendement(valeur);
    votes.push({
      ordreAbsolu,
      cible: cibleVote,
      numeros,
      articleVise: contexte.articleVise,
      texteNumero: contexte.texteNumero,
      resultat: null,
    });
  }

  if (!nomBrut || !Number.isFinite(ordreAbsolu)) return;

  const { prenom, nom } = decouperNom(nomBrut);
  const estPresidence = /^(le |la )?pr[ée]sident/i.test(nom) || /^pr[ée]sident/i.test(qualite);

  prises.push({
    sourceUid: attribs['id_syceron'] ?? `${attribs['id_preparation'] ?? ordreAbsolu}`,
    ordreAbsolu,
    codeGrammaire,
    orateurRef: idActeur && /^PA\d+$/.test(idActeur) ? idActeur : null,
    orateurNom: nom,
    orateurPrenom: prenom,
    orateurQualite: qualite.length > 0 ? qualite : null,
    contenu,
    articleVise: contexte.articleVise,
    amendementsVises: numerosAmendement(valeur),
    texteNumero: contexte.texteNumero,
    estPresidence,
  });
}

/**
 * Associe à chaque annonce la proclamation chiffrée qui la suit.
 *
 * On borne la recherche à quelques paragraphes : au-delà, on serait déjà dans
 * la mise aux voix suivante, et un résultat rattaché au mauvais scrutin est
 * pire qu'un résultat absent.
 */
function rattacherResultats(prises: PriseDeParoleSyceron[], votes: VoteAnnonceSyceron[]): void {
  const parOrdre = new Map<number, PriseDeParoleSyceron>();
  for (const prise of prises) parOrdre.set(prise.ordreAbsolu, prise);

  const ordonnees = [...parOrdre.keys()].sort((a, b) => a - b);

  for (const vote of votes) {
    const depart = ordonnees.findIndex((o) => o > vote.ordreAbsolu);
    if (depart === -1) continue;
    for (const ordre of ordonnees.slice(depart, depart + PORTEE_RESULTAT)) {
      const prise = parOrdre.get(ordre);
      if (!prise || !RESULTAT_VOTE.has(prise.codeGrammaire)) continue;
      vote.resultat = resultatProclame(prise.contenu);
      break;
    }
  }
}

/** Texte lisible : le compte rendu encode les exposants et les insécables. */
export function nettoyer(brut: string): string {
  return brut
    .replace(/\[\[o\]\]/g, 'o')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
