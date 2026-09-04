// =============================================================================
// IA Quality Checks — Detect inversions and ungrounded claims in AI summaries
// Compares group positions described in enjeux/resume_ia against actual vote data
// =============================================================================

import { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface IAInversion {
  entityType: 'sujet' | 'dossier';
  entityId: string;
  label: string;
  groupe: string;
  orientation: string | null;
  describedAs: 'FAVORABLE' | 'OPPOSED';
  actualPour: number;
  actualContre: number;
  actualTendency: string;
  context: string;
}

/**
 * Défauts d'ancrage : le texte affirme quelque chose que les votes ne portent pas.
 * - `abstention_described_as_vote` : le groupe s'est abstenu (en bloc ou
 *   majoritairement) mais le texte lui prête un vote pour ou contre.
 * - `group_not_in_data` : le texte attribue une position à un groupe qui n'a
 *   aucun vote sur cette entité.
 * - `group_missing_from_text` : un groupe pesant dans les votes n'est jamais
 *   mentionné (signal informatif, pas une erreur en soi).
 */
export type IAGroundingKind =
  | 'abstention_described_as_vote'
  | 'group_not_in_data'
  | 'group_missing_from_text';

export interface IAGroundingIssue {
  entityType: 'sujet' | 'dossier';
  entityId: string;
  label: string;
  kind: IAGroundingKind;
  groupe: string;
  orientation: string | null;
  detail: string;
  context: string;
}

export interface IAQualityReport {
  totalSujets: number;
  totalDossiers: number;
  sujetsWithEnsemble: number;
  dossiersWithEnsemble: number;
  inversions: IAInversion[];
  grounding: IAGroundingIssue[];
  passed: boolean;
  duration: string;
}

/**
 * Seuils, mesurés sur la prod le 2026-08-05 APRÈS régénération complète du
 * corpus avec le prompt corrigé.
 *
 * Historique des deux seuils d'ancrage — ce sont des dettes, pas des
 * tolérances, et ils doivent tendre vers 0 :
 *   - abstention travestie : 257 avant régénération → 85 après (-67 %).
 *     Le résidu est de la non-conformité du modèle, qui englobe encore parfois
 *     un groupe abstentionniste dans une énumération « ont soutenu / ont voté
 *     contre ». Concentré sur les sujets multi-scrutins, où le vote « ensemble »
 *     agrège plusieurs votes et perd son sens.
 *   - position prêtée à un groupe absent : 38 → 15.
 *
 * Le seuil d'inversions MONTE (189 → 257) sans régression de qualité : le
 * prompt transmet désormais 73 % de lignes de position en plus, donc les
 * résumés nomment beaucoup plus de groupes, donc la regex ouvre beaucoup plus
 * de fenêtres de contexte. Le dénominateur a changé, pas le taux d'erreur.
 * Cette famille reste très bruitée (fenêtre de 120 caractères) et ne sert que
 * de garde-fou grossier ; c'est le sous-ensemble « haute confiance » (>50 voix
 * exprimées) qu'il faut auditer à la main.
 */
export const IA_QUALITY_THRESHOLDS = {
  // 280 → 70 le 2026-09-04 : le seuil couvrait le bruit du détecteur, pas des
  // résumés fautifs. Bornage du contexte aux charnières, aux fins de phrase et
  // neutralisation des négations : 300 signalements → 62, dont plus aucun
  // n'est une inversion démontrable (cf. commentaire de checkInversions).
  maxInversions: 70,
  maxAbstentionDescribedAsVote: 90,
  maxGroupNotInData: 20,
};

// =============================================================================
// Pattern matching
// =============================================================================

const FAV_PATTERN = /soutien|soutenu|soutient|soutiennent|favorable|favorables|voté pour|votent pour|approuvé|en faveur|massivement pour|unanimement pour|plébiscité|adhésion/i;
const OPP_PATTERN = /opposé|opposés|oppose|opposent|rejeté|rejette|rejettent|voté contre|votent contre|fermement contre|massivement contre|unanimement contre|hostil|défavorable/i;
// Radical volontairement large : abstention, abstenu, s'abstenant, s'abstenir,
// s'abstient, s'abstiennent, s'abstinrent.
const ABST_PATTERN = /abstent|absten|abstien|abstin|ni pour ni contre/i;

/**
 * Alias indexés sur le SIGLE du groupe (`groupes_politiques.nom`), pas sur son
 * intitulé long : c'est le sigle que remontent les requêtes de vote. L'ancienne
 * table était indexée sur `nom_complet` et ne matchait donc jamais, ce qui
 * laissait le sigle nu (« RN », « DR ») être cherché en sous-chaîne — d'où les
 * faux positifs sur « gouvernement », « moderne », « tournant »…
 */
const GROUP_ALIASES: Record<string, string[]> = {
  RN: ['rassemblement national', 'lepénistes'],
  'LFI-NFP': ['france insoumise', 'insoumis', 'lfi'],
  'LFI-NUPES': ['france insoumise', 'insoumis', 'lfi'],
  FI: ['france insoumise', 'insoumis', 'lfi'],
  SOC: ['socialistes', 'socialiste', 'parti socialiste'],
  'SOC-A': ['socialistes', 'socialiste'],
  EPR: ['ensemble pour la république', 'renaissance'],
  RE: ['renaissance'],
  LAREM: ['la république en marche'],
  ECOS: ['écologistes', 'écologiste', 'ecologistes'],
  ECOLO: ['écologistes', 'écologiste', 'ecologistes'],
  GEST: ['écologistes', 'écologiste'],
  DR: ['droite républicaine', 'les républicains'],
  LR: ['les républicains'],
  UMP: ['les républicains', 'républicains'],
  GDR: ['gauche démocrate et républicaine', 'communistes', 'communiste'],
  'GDR-NUPES': ['gauche démocrate et républicaine', 'communistes'],
  CRC: ['communistes', 'communiste'],
  HOR: ['horizons'],
  DEM: ['modem', 'mouvement démocrate', 'démocrates'],
  MODEM: ['modem', 'mouvement démocrate'],
  LIOT: ['libertés, indépendants, outre-mer et territoires'],
  UDDPLR: ['union des droites'],
  UC: ['union centriste'],
  RDSE: ['rassemblement démocratique et social européen'],
  RTLI: ['les indépendants'],
  NI: ['non-inscrits', 'non inscrits'],
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Deux familles de sigles partageant un alias désignent la même famille
 * politique à des législatures différentes (FI / LFI-NUPES / LFI-NFP,
 * SOC / SOC-A, GDR / GDR-NUPES / CRC, DR / LR / UMP…). La table est dérivée des
 * alias plutôt que maintenue à la main : ajouter un alias suffit à rattacher un
 * nouveau sigle à sa famille.
 */
const FAMILY_OF: Map<string, string> = (() => {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) ?? r;
    return r;
  };
  const union = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(rb, ra);
  };

  const byAlias = new Map<string, string[]>();
  for (const [sigle, aliases] of Object.entries(GROUP_ALIASES)) {
    parent.set(sigle, sigle);
    for (const a of aliases) {
      if (!byAlias.has(a)) byAlias.set(a, []);
      byAlias.get(a)!.push(sigle);
    }
  }
  for (const sigles of byAlias.values()) {
    const [premier, ...autres] = sigles;
    if (!premier) continue;
    for (const autre of autres) union(premier, autre);
  }

  return new Map([...parent.keys()].map(s => [s, find(s)]));
})();

export const familyOf = (nom: string) => FAMILY_OF.get(nom) ?? nom;

/**
 * Un groupe se repère de deux façons, avec des règles de casse différentes :
 * - son SIGLE, cherché en majuscules et à frontières de mot. Sans la
 *   sensibilité à la casse, « NI » matche la conjonction « ni », « DR » matche
 *   « dr », « RE » matche « re »…
 * - son intitulé long et ses alias, cherchés sans distinction de casse.
 */
export interface GroupMatcher {
  sigle: RegExp;
  /** Intitulé officiel du groupe. Non ambigu. */
  nomComplet: RegExp | null;
  /** Désignations courantes (« les écologistes »). Pratiques mais grossières :
   *  `démocrates` matche à l'intérieur de « Rassemblement des démocrates,
   *  progressistes et indépendants », `écologiste` dans « Socialiste,
   *  Écologiste et Républicain ». Réservées à la détection de présence. */
  alias: RegExp | null;
}

export function buildGroupMatcher(nom: string, nomComplet: string | null): GroupMatcher {
  // \p{L} plutôt que \w : « écologiste » ne doit pas matcher dans « écologistes ».
  const bounded = (alternation: string, flags: string) =>
    new RegExp(`(?<![\\p{L}\\d])(?:${alternation})(?![\\p{L}\\d])`, flags);

  const alias = GROUP_ALIASES[nom] ?? [];

  return {
    sigle: bounded(escapeRegex(nom.toUpperCase()), 'u'),
    nomComplet: nomComplet ? bounded(escapeRegex(nomComplet.toLowerCase()), 'iu') : null,
    alias: alias.length > 0
      ? bounded([...alias].sort((a, b) => b.length - a.length).map(escapeRegex).join('|'), 'iu')
      : null,
  };
}

/**
 * Première mention du groupe. `strict` restreint au sigle et à l'intitulé
 * officiel, en excluant les alias : c'est le mode à utiliser pour affirmer
 * qu'un groupe est ABSENT des données, où un alias grossier attribuerait la
 * mention au mauvais groupe.
 */
export function matchGroup(
  text: string,
  m: GroupMatcher,
  opts: { strict?: boolean } = {},
): { index: number; mention: string } | null {
  const regexes = opts.strict ? [m.sigle, m.nomComplet] : [m.sigle, m.nomComplet, m.alias];
  const hits: { index: number; mention: string }[] = [];
  for (const re of regexes) {
    if (!re) continue;
    const hit = text.match(re);
    if (hit && hit.index !== undefined) hits.push({ index: hit.index, mention: hit[0] });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits[0] ?? null;
}

function matcherHits(m: GroupMatcher, s: string): boolean {
  return m.sigle.test(s) || (m.nomComplet?.test(s) ?? false) || (m.alias?.test(s) ?? false);
}

export function computeTendency(pour: number, contre: number, abstention: number): string {
  const expr = pour + contre;
  if (expr === 0) return 'ABSTENTION';
  // L'abstention majoritaire prime sur le ratio des rares voix exprimées :
  // 0 pour / 1 contre / 12 abstentions n'est pas un groupe « opposé ».
  if (abstention >= expr) return 'ABSTENTION_MAJ';
  const pct = (pour / expr) * 100;
  if (pct >= 70) return 'FAV';
  if (pct >= 55) return 'PFAV';
  if (pct <= 30) return 'OPP';
  if (pct <= 45) return 'POPP';
  return 'DIV';
}

export interface GroupeVote {
  groupe: string;
  nomComplet: string | null;
  orientation: string | null;
  pour: number;
  contre: number;
  abstention: number;
  matcher: GroupMatcher;
}

/**
 * Charnières adversatives : elles séparent deux propositions qui parlent de
 * groupes DIFFÉRENTS, avec des polarités opposées.
 *
 * « LR et UC ont voté en faveur du texte, TANDIS QUE le groupe SOC et le groupe
 * CRC s'y sont opposés » : une fenêtre brute centrée sur SOC ramasse le « voté
 * en faveur » de la proposition précédente et fait conclure à une inversion qui
 * n'existe pas. C'était la quasi-totalité des 101 signalements de haute
 * confiance relevés le 2026-09-04.
 */
//
// Les bornes sont écrites en lookaround sur les classes Unicode, et non avec
// `\b` : ce dernier ne connaît que les caractères ASCII, si bien que `\bà`
// précédé d'une espace ne matche jamais — « À l'inverse » en tête de phrase
// passait au travers. Un test le vérifie.
const CHARNIERES = /(?<![\p{L}\p{N}])(?:[àa]\s+l['’]inverse|[àa]\s+l['’]oppos[ée]|en\s+revanche|au\s+contraire|inversement|tandis\s+qu[e']|alors\s+qu[e']|contrairement\s+[àa]|de\s+(?:son|leur)\s+c[ôo]t[ée]|pour\s+(?:sa|leur)\s+part|quant\s+[àa]|mais)(?![\p{L}\p{N}])/giu;

/**
 * Fenêtre de contexte autour de la mention d'un groupe, bornée à la proposition
 * qui parle de LUI.
 *
 * Resserrer la fenêtre coûte de la sensibilité : une inversion dont le verbe est
 * séparé de la mention par une charnière n'est plus vue. C'est le prix de la
 * précision, et le bon arbitrage ici — un signalement faux use la confiance dans
 * le garde-fou jusqu'à ce qu'on cesse de le lire.
 */
function contextAround(text: string, idx: number): string {
  const debut = Math.max(0, idx - 120);
  const fin = Math.min(text.length, idx + 150);

  let gauche = bornerAGauche(text, debut, idx, CHARNIERES);
  let droite = bornerADroite(text, idx, fin, CHARNIERES);

  // Une fin de phrase sépare aussi sûrement que « à l'inverse » : « Le groupe
  // UMP s'est montré très opposé au texte. Le groupe SOC et le groupe CRC
  // ont… » faisait décrire SOC comme opposé. On ne coupe que sur une
  // ponctuation forte suivie d'une espace et d'une majuscule, pour ne pas
  // trébucher sur « M. Dupont » ou « art. 3 ».
  const FIN_DE_PHRASE = /[.;!?]\s+(?=[A-ZÀÂÉÈÊÎÔÙÜÇ])/g;
  gauche = bornerAGauche(text, gauche, idx, FIN_DE_PHRASE);
  droite = bornerADroite(text, idx, droite, FIN_DE_PHRASE);

  return text.slice(gauche, Math.max(gauche, droite)).replace(/\n/g, ' ').trim();
}

/** Dernière occurrence de `motif` entre `depuis` et `idx`, bord droit compris. */
function bornerAGauche(text: string, depuis: number, idx: number, motif: RegExp): number {
  let borne = depuis;
  motif.lastIndex = depuis;
  for (let m = motif.exec(text); m && m.index < idx; m = motif.exec(text)) {
    borne = m.index + m[0].length;
  }
  return borne;
}

/** Première occurrence de `motif` entre `idx` et `jusqu`. */
function bornerADroite(text: string, idx: number, jusqu: number, motif: RegExp): number {
  motif.lastIndex = idx;
  const m = motif.exec(text);
  return m && m.index < jusqu ? m.index : jusqu;
}

/**
 * Neutralise les propositions négatives avant la recherche de polarité.
 *
 * « Aucun groupe n'a voté contre » disait le contraire de ce que la regex y
 * lisait : les quatre groupes de `articles-loi-egalim`, tous unanimement pour,
 * étaient signalés comme opposés.
 */
function sansNegations(contexte: string): string {
  return contexte.replace(/\baucun[e]?\b[^.;!?]*/giu, ' ');
}

/**
 * `strict` évite de centrer la fenêtre de contexte sur un alias qui a matché à
 * l'intérieur du nom officiel d'un AUTRE groupe (« Écologiste » dans
 * « Socialiste, Écologiste et Républicain ») : on analyserait alors le mauvais
 * passage et on signalerait une inversion inexistante.
 */
function findGroup(text: string, v: GroupeVote, strict = false): number {
  return matchGroup(text, v.matcher, { strict })?.index ?? -1;
}

// =============================================================================
// Check 1 — inversions pour/contre (garde-fou historique, bruité)
// =============================================================================
//
// Ce qu'il reste de bruit après le bornage du contexte tient à l'agrégat, pas au
// texte : `votes` additionne les deux chambres, les législatures successives et
// toutes les lectures d'un même sujet, sous un sigle unique. « SOC » couvre
// ainsi le groupe socialiste de l'Assemblée ET celui du Sénat — sur
// `election-des-representants-au-parlement-europeen`, 3P/20C à l'Assemblée en
// février 2018 et 68P/4C au Sénat en avril additionnés en un seul « FAV »,
// opposé à une phrase qui décrivait correctement la lecture de l'Assemblée.
//
// S'y ajoutent les résumés qui parlent d'un vote sur article ou d'une motion,
// quand l'agrégat ne compte que les votes sur l'ensemble.
//
// Tant que la comparaison reste globale, ce détecteur signale des écarts de
// périmètre autant que des erreurs. Le lire comme une alarme absolue conduit à
// « corriger » des résumés justes.
// =============================================================================

export function checkInversions(text: string, votes: GroupeVote[]) {
  const issues: {
    groupe: string; orientation: string | null;
    describedAs: 'FAVORABLE' | 'OPPOSED';
    pour: number; contre: number; tendency: string; context: string;
  }[] = [];

  for (const v of votes) {
    const expr = v.pour + v.contre;
    if (expr < 15) continue; // Skip small groups

    const tendency = computeTendency(v.pour, v.contre, v.abstention);
    // Un groupe divisé ou majoritairement abstentionniste ne peut pas être
    // « inversé » : c'est checkGrounding qui traite l'abstention.
    if (tendency === 'DIV' || tendency === 'ABSTENTION' || tendency === 'ABSTENTION_MAJ') continue;

    const idx = findGroup(text, v, true);
    if (idx < 0) continue;

    const context = contextAround(text, idx);
    const polarite = sansNegations(context);
    const isFav = FAV_PATTERN.test(polarite);
    const isOpp = OPP_PATTERN.test(polarite);

    if ((tendency === 'FAV' || tendency === 'PFAV') && isOpp && !isFav) {
      issues.push({ groupe: v.groupe, orientation: v.orientation, describedAs: 'OPPOSED', pour: v.pour, contre: v.contre, tendency, context });
    } else if ((tendency === 'OPP' || tendency === 'POPP') && isFav && !isOpp) {
      issues.push({ groupe: v.groupe, orientation: v.orientation, describedAs: 'FAVORABLE', pour: v.pour, contre: v.contre, tendency, context });
    }
  }

  return issues;
}

// =============================================================================
// Check 2 — ancrage : abstention travestie, groupe absent des données, omission
// =============================================================================

/** En-deçà, un groupe est trop marginal pour qu'on exige sa mention. */
const MIN_VOTANTS_MENTION = 5;
/** En-deçà, une abstention peut être un aléa de présence plutôt qu'une consigne. */
const MIN_ABSTENTION_BLOC = 5;

export function checkGrounding(
  text: string,
  votes: GroupeVote[],
  otherGroups: { nom: string; nomComplet: string | null; orientation: string | null; matcher: GroupMatcher }[],
  /**
   * Familles présentes dans les données transmises au LLM, votes par article
   * compris. Plus large que `votes` (qui n'agrège que le vote sur l'ensemble) :
   * un groupe peut n'avoir voté que sur des articles, sa position n'est alors
   * pas inventée.
   */
  famillesDansLesDonnees: Set<string>,
): Omit<IAGroundingIssue, 'entityType' | 'entityId' | 'label'>[] {
  const issues: Omit<IAGroundingIssue, 'entityType' | 'entityId' | 'label'>[] = [];

  for (const v of votes) {
    const total = v.pour + v.contre + v.abstention;
    const idx = findGroup(text, v);

    // (a) Abstention décrite comme un vote
    const tendency = computeTendency(v.pour, v.contre, v.abstention);
    const abstientEnBloc =
      (tendency === 'ABSTENTION' || tendency === 'ABSTENTION_MAJ') && v.abstention >= MIN_ABSTENTION_BLOC;

    if (abstientEnBloc && idx >= 0) {
      const context = contextAround(text, idx);
      const claimsVote = FAV_PATTERN.test(context) || OPP_PATTERN.test(context);
      if (claimsVote && !ABST_PATTERN.test(context)) {
        issues.push({
          kind: 'abstention_described_as_vote',
          groupe: v.groupe,
          orientation: v.orientation,
          detail: `${v.pour}P/${v.contre}C/${v.abstention}A — abstention mais décrit comme un vote`,
          context,
        });
      }
    }

    // (c) Groupe pesant jamais mentionné
    if (idx < 0 && total > MIN_VOTANTS_MENTION) {
      issues.push({
        kind: 'group_missing_from_text',
        groupe: v.groupe,
        orientation: v.orientation,
        detail: `${v.pour}P/${v.contre}C/${v.abstention}A — absent du texte`,
        context: '',
      });
    }
  }

  // (b) Position attribuée à un groupe sans aucun vote sur cette entité.
  // Comparaison par FAMILLE et non par sigle : « La France insoumise » ne doit
  // pas être signalée absente au motif que le sigle d'une autre législature
  // (FI, LFI-NUPES) n'a pas voté. On dédoublonne ensuite sur le texte matché.
  const famillesAvecVotes = famillesDansLesDonnees;
  const dejaSignale = new Set<string>();
  const famillesSignalees = new Set<string>();

  for (const g of otherGroups) {
    if (famillesAvecVotes.has(familyOf(g.nom))) continue;
    if (famillesSignalees.has(familyOf(g.nom))) continue;

    const match = matchGroup(text, g.matcher, { strict: true });
    if (!match) continue;

    const mention = match.mention.toLowerCase();
    if (dejaSignale.has(mention)) continue;
    // Un groupe ayant voté revendique-t-il déjà cette mention ?
    if (votes.some(v => matcherHits(v.matcher, match.mention))) continue;

    const context = contextAround(text, match.index);
    if (!FAV_PATTERN.test(context) && !OPP_PATTERN.test(context) && !ABST_PATTERN.test(context)) continue;

    dejaSignale.add(mention);
    famillesSignalees.add(familyOf(g.nom));
    issues.push({
      kind: 'group_not_in_data',
      groupe: g.nom,
      orientation: g.orientation,
      detail: `« ${match.mention} » : aucun vote sur cette entité, mais une position lui est prêtée`,
      context,
    });
  }

  return issues;
}

// =============================================================================
// Main check
// =============================================================================

type VoteRow = {
  entity_id: string;
  groupe: string;
  nom_complet: string | null;
  orientation: string | null;
  pour: bigint;
  contre: bigint;
  abstention: bigint;
};

function toGroupeVote(v: VoteRow): GroupeVote {
  return {
    groupe: v.groupe,
    nomComplet: v.nom_complet,
    orientation: v.orientation,
    pour: Number(v.pour),
    contre: Number(v.contre),
    abstention: Number(v.abstention),
    matcher: buildGroupMatcher(v.groupe, v.nom_complet),
  };
}

/**
 * Familles politiques ayant voté sur une entité, votes par article compris.
 * Même périmètre que les données injectées dans le prompt (cf. ia-enrichment) :
 * signaler un groupe « absent des données » alors que le LLM voyait ses votes
 * par article produirait un faux positif systématique.
 */
type PresenceRow = { entity_id: string; groupe: string };

function indexPresence(rows: PresenceRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.entity_id)) map.set(r.entity_id, new Set());
    map.get(r.entity_id)!.add(familyOf(r.groupe));
  }
  return map;
}

export async function runIAQualityChecks(prisma: PrismaClient): Promise<IAQualityReport> {
  const start = Date.now();
  const inversions: IAInversion[] = [];
  const grounding: IAGroundingIssue[] = [];

  // Référentiel des groupes, dédupliqué par sigle : sert à repérer un groupe
  // cité dans le texte alors qu'il n'a aucun vote sur l'entité.
  const allGroupes = await prisma.groupePolitique.findMany({
    select: { nom: true, nomComplet: true, position: true },
  });
  const knownGroups = [...new Map(allGroupes.map(g => [g.nom, g])).values()].map(g => ({
    nom: g.nom,
    nomComplet: g.nomComplet,
    orientation: g.position,
    matcher: buildGroupMatcher(g.nom, g.nomComplet),
  }));

  // 1. Sujets avec enjeux
  const sujets = await prisma.sujet.findMany({
    where: { enjeux: { not: null } },
    select: { id: true, slug: true, label: true, enjeux: true },
  });

  const sujetIds = sujets.map(s => s.id);
  const sujetVotes = sujetIds.length > 0
    ? await prisma.$queryRaw<VoteRow[]>`
        SELECT s.slug as entity_id, gp.nom as groupe, gp.nom_complet, gp.position as orientation,
          SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
          SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
          SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
        FROM sujets s
        JOIN dossiers_legislatifs d ON d.sujet_id = s.id
        JOIN scrutins sc ON sc.dossier_id = d.id
        JOIN votes v ON v.scrutin_id = sc.id
        JOIN parlementaires p ON p.id = v.parlementaire_id
        JOIN groupes_politiques gp ON gp.id = p.groupe_id
        WHERE s.id = ANY(${sujetIds})
          AND (sc.type_vote = 'solennel' OR sc.titre ILIKE '%ensemble%')
          AND v.position != 'absent'
        GROUP BY s.slug, gp.nom, gp.nom_complet, gp.position
        HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
               SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
               SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END) > 3
      `
    : [];

  const sujetPresence = indexPresence(sujetIds.length > 0
    ? await prisma.$queryRaw<PresenceRow[]>`
        SELECT DISTINCT s.slug as entity_id, gp.nom as groupe
        FROM sujets s
        JOIN dossiers_legislatifs d ON d.sujet_id = s.id
        JOIN scrutins sc ON sc.dossier_id = d.id
        JOIN votes v ON v.scrutin_id = sc.id
        JOIN parlementaires p ON p.id = v.parlementaire_id
        JOIN groupes_politiques gp ON gp.id = p.groupe_id
        WHERE s.id = ANY(${sujetIds}) AND v.position != 'absent'
      `
    : []);

  const sujetVoteMap = new Map<string, GroupeVote[]>();
  for (const v of sujetVotes) {
    if (!sujetVoteMap.has(v.entity_id)) sujetVoteMap.set(v.entity_id, []);
    sujetVoteMap.get(v.entity_id)!.push(toGroupeVote(v));
  }

  for (const s of sujets) {
    const votes = sujetVoteMap.get(s.slug);
    if (!votes) continue;
    const presence = sujetPresence.get(s.slug) ?? new Set<string>();

    for (const issue of checkInversions(s.enjeux!, votes)) {
      inversions.push({
        entityType: 'sujet', entityId: s.slug, label: s.label,
        groupe: issue.groupe, orientation: issue.orientation, describedAs: issue.describedAs,
        actualPour: issue.pour, actualContre: issue.contre, actualTendency: issue.tendency,
        context: issue.context.slice(0, 200),
      });
    }
    for (const issue of checkGrounding(s.enjeux!, votes, knownGroups, presence)) {
      grounding.push({ entityType: 'sujet', entityId: s.slug, label: s.label, ...issue, context: issue.context.slice(0, 200) });
    }
  }

  // 2. Dossiers avec resume_ia
  const dossierVotes = await prisma.$queryRaw<(VoteRow & { resume_ia: string; titre: string })[]>`
    SELECT d.uid as entity_id, d.titre, d.resume_ia,
      gp.nom as groupe, gp.nom_complet, gp.position as orientation,
      SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
      SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
      SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
    FROM dossiers_legislatifs d
    JOIN scrutins sc ON sc.dossier_id = d.id
    JOIN votes v ON v.scrutin_id = sc.id
    JOIN parlementaires p ON p.id = v.parlementaire_id
    JOIN groupes_politiques gp ON gp.id = p.groupe_id
    WHERE d.resume_ia IS NOT NULL
      AND (sc.type_vote = 'solennel' OR sc.titre ILIKE '%ensemble%')
      AND v.position != 'absent'
    GROUP BY d.uid, d.titre, d.resume_ia, gp.nom, gp.nom_complet, gp.position
    HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
           SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
           SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END) > 3
  `;

  const dossierPresence = indexPresence(await prisma.$queryRaw<PresenceRow[]>`
    SELECT DISTINCT d.uid as entity_id, gp.nom as groupe
    FROM dossiers_legislatifs d
    JOIN scrutins sc ON sc.dossier_id = d.id
    JOIN votes v ON v.scrutin_id = sc.id
    JOIN parlementaires p ON p.id = v.parlementaire_id
    JOIN groupes_politiques gp ON gp.id = p.groupe_id
    WHERE d.resume_ia IS NOT NULL AND v.position != 'absent'
  `);

  const dossierMap = new Map<string, { titre: string; resume: string; votes: GroupeVote[] }>();
  for (const v of dossierVotes) {
    if (!dossierMap.has(v.entity_id)) {
      dossierMap.set(v.entity_id, { titre: v.titre, resume: v.resume_ia, votes: [] });
    }
    dossierMap.get(v.entity_id)!.votes.push(toGroupeVote(v));
  }

  for (const [uid, d] of dossierMap) {
    const label = d.titre.slice(0, 80);
    for (const issue of checkInversions(d.resume, d.votes)) {
      inversions.push({
        entityType: 'dossier', entityId: uid, label,
        groupe: issue.groupe, orientation: issue.orientation, describedAs: issue.describedAs,
        actualPour: issue.pour, actualContre: issue.contre, actualTendency: issue.tendency,
        context: issue.context.slice(0, 200),
      });
    }
    for (const issue of checkGrounding(d.resume, d.votes, knownGroups, dossierPresence.get(uid) ?? new Set())) {
      grounding.push({ entityType: 'dossier', entityId: uid, label, ...issue, context: issue.context.slice(0, 200) });
    }
  }

  const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;
  const count = (k: IAGroundingKind) => grounding.filter(g => g.kind === k).length;

  return {
    totalSujets: sujets.length,
    totalDossiers: dossierMap.size,
    sujetsWithEnsemble: sujetVoteMap.size,
    dossiersWithEnsemble: dossierMap.size,
    inversions,
    grounding,
    // `group_missing_from_text` est informatif : un résumé n'a pas à citer les
    // douze groupes. Les deux autres familles sont des affirmations fausses.
    passed:
      inversions.length <= IA_QUALITY_THRESHOLDS.maxInversions &&
      count('abstention_described_as_vote') <= IA_QUALITY_THRESHOLDS.maxAbstentionDescribedAsVote &&
      count('group_not_in_data') <= IA_QUALITY_THRESHOLDS.maxGroupNotInData,
    duration,
  };
}

export function printIAQualityReport(report: IAQualityReport): void {
  const byKind = (k: IAGroundingKind) => report.grounding.filter(g => g.kind === k);
  const abstention = byKind('abstention_described_as_vote');
  const notInData = byKind('group_not_in_data');
  const missing = byKind('group_missing_from_text');

  console.log('\n🤖 Qualité des résumés IA');
  console.log(`   Sujets audités: ${report.totalSujets} (${report.sujetsWithEnsemble} avec données ensemble)`);
  console.log(`   Dossiers audités: ${report.totalDossiers} avec données ensemble`);

  console.log(`\n   🔴 Abstention décrite comme un vote: ${abstention.length} (seuil ${IA_QUALITY_THRESHOLDS.maxAbstentionDescribedAsVote})`);
  for (const g of abstention.slice(0, 15)) {
    console.log(`      ${g.entityType}:${g.entityId} — ${g.groupe} [${g.orientation}] ${g.detail}`);
    console.log(`         « ...${g.context.trim()}... »`);
  }
  if (abstention.length > 15) console.log(`      ... et ${abstention.length - 15} autres`);

  console.log(`\n   🔴 Position prêtée à un groupe absent des données: ${notInData.length} (seuil ${IA_QUALITY_THRESHOLDS.maxGroupNotInData})`);
  for (const g of notInData.slice(0, 15)) {
    console.log(`      ${g.entityType}:${g.entityId} — ${g.groupe} [${g.orientation}]`);
    console.log(`         « ...${g.context.trim()}... »`);
  }
  if (notInData.length > 15) console.log(`      ... et ${notInData.length - 15} autres`);

  const missingEntities = new Set(missing.map(g => `${g.entityType}:${g.entityId}`));
  console.log(`\n   ℹ️  Groupes pesants non mentionnés: ${missing.length} sur ${missingEntities.size} entités (informatif)`);

  console.log(`\n   Inversions pour/contre (regex): ${report.inversions.length} (seuil ${IA_QUALITY_THRESHOLDS.maxInversions})`);
  const highConfidence = report.inversions.filter(i => i.actualPour + i.actualContre > 50);
  if (highConfidence.length > 0) {
    console.log(`   🔴 Haute confiance (>50 votes exprimés): ${highConfidence.length}`);
    for (const inv of highConfidence.slice(0, 15)) {
      console.log(`      ${inv.entityType}:${inv.entityId} — ${inv.groupe} [${inv.orientation}] décrit ${inv.describedAs} mais ${inv.actualPour}P/${inv.actualContre}C (${inv.actualTendency})`);
    }
    if (highConfidence.length > 15) console.log(`      ... et ${highConfidence.length - 15} autres`);
  }

  console.log(`\n   ${report.passed ? '✅ PASSED' : '❌ FAILED'} — durée: ${report.duration}`);
}
