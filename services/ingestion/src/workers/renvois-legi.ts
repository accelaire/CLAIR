// =============================================================================
// Worker — Renvois au droit en vigueur dans le texte des amendements
// =============================================================================
//
// Repère dans le dispositif d'un amendement et dans son exposé sommaire les
// textes et articles du droit français cités (« l'article L. 121-1 du code de
// la consommation ») et les rattache à l'index LEGI (`legi_textes`,
// `legi_articles`, workers/index-legi.ts) : identifiant Légifrance de
// l'article, dans sa version en vigueur à la date de dépôt (T5, ticket #46).
// Le résultat va dans `amendements_renvois`, une ligne par amendement traité,
// renvois en positions dans `amendements.dispositif` (`renvois`) et dans
// `amendements.expose_sommaire` (`renvois_expose`).
//
// La grammaire est celle de @tricoteuses/tisseuse ; la résolution, la nôtre,
// adossée à l'index LEGI (`ResolveurLegi`). Deux écarts assumés avec le
// résolveur de référence :
//  - pas de devinette par numéro seul (`getUniqueActiveArticlesByNum`) : un
//    « article 3 » sans texte désigne presque toujours un article du texte en
//    discussion, que la devinette envoyait vers un décret au hasard (essai du
//    25/10/2026) ;
//  - pas de sections (titres, chapitres) : l'index n'en garde pas.
//
// Contexte : un dispositif dit souvent « À l'alinéa 3, … l'article L. 632-1 … »
// sans nommer le code, que nomme l'article du projet amendé. Pour un amendement
// AN sur un article (pas « après l'article »), le texte de cet article
// (`textes_articles`) est lu d'abord, et le dernier texte qu'il cite sert de
// texte courant au dispositif. L'exposé est lu avec le même contexte, mais
// n'en garde que les articles dont le texte est nommé (`texteNomme`).
// =============================================================================

import { PrismaClient } from '@prisma/client';
import type {
  LegiArticleInfo,
  LegiResolver,
  LegiSectionInfo,
  TextAstText,
  TextTitlesInfoRow,
} from '@tricoteuses/tisseuse';
import { articleKeyFromArticleVise } from '../sources/assemblee-nationale/textes-client.js';
import { articleLookupKeys } from '../utils/article-scrutin.js';
import { logger } from '../utils/logger.js';
import { VERSION_DETECTION } from '../utils/version-renvois-legi.js';

const prisma = new PrismaClient();

type Tisseuse = typeof import('@tricoteuses/tisseuse');


/**
 * La DILA consolide un texte publié au Journal officiel avec quelques jours ou
 * semaines de retard : un amendement récent qui cite une loi toute neuve est
 * recalculé chaque nuit pendant cette durée.
 */
const JOURS_RECALCUL_RECENTS = 45;

/** Amendements lus, analysés et écrits par lot. */
const TAILLE_LOT = 500;

/**
 * Amendements calculés par une version antérieure de la détection, et qui
 * n'ont pas d'autre raison d'être recalculés, repris par un passage sans
 * `--tout`. Une nouvelle version recalcule ainsi toute la base en quelques
 * nuits (535 000 amendements en novembre 2026) au lieu d'allonger une seule
 * nuit de plusieurs heures. `sync-renvois-legi --tout` va plus vite.
 */
const RATTRAPAGE_PAR_PASSAGE = 60_000;

/**
 * Natures dont les titres ne sont pas chargés. Les arrêtés font 60 % des
 * titres de l'index (92 000) : sans eux, mesuré sur 3 000 amendements le
 * 31/10/2026, le chargement passe de 75 s à 6 s et de 1,85 à 0,89 Go, pour un
 * lien de moins sur 2 840. Les 12 titres que tisseuse ne sait pas lire en
 * sont tous.
 */
const NATURES_TITRES_IGNOREES: ReadonlySet<string> = new Set(['ARRETE']);

/** Fin de vigueur des versions sans fin connue, comme la DILA l'écrit. */
const FIN_OUVERTE = '2999-01-01';

export interface RenvoiLegi {
  /** Positions dans le texte analysé (dispositif ou exposé), en unités de code UTF-16 (`String#slice`). */
  debut: number;
  fin: number;
  type: 'article' | 'texte';
  /** LEGIARTI de la version citée (article seulement). */
  article?: string;
  /** CID du texte : LEGITEXT d'un code, JORFTEXT d'un texte publié au JO. */
  cid: string;
  /** Nature LEGI du texte (CODE, LOI…), si l'index la connaît. */
  nature: string | null;
}

// =============================================================================
// RÉSOLVEUR
// =============================================================================

interface VersionArticle {
  id: string;
  num: string;
  dateDebut: string;
  dateFin: string;
}

/** La version était-elle en vigueur ce jour-là ? Bornes de la DILA : début inclus, fin exclue. */
export function enVigueur(v: { dateDebut: string; dateFin: string }, date: string): boolean {
  return v.dateDebut <= date && date < v.dateFin;
}

/** Date LEGI → date de titre pour tisseuse : la fin ouverte n'est pas une date. */
function dateTitre(d: string | null): string | null {
  return d && d !== FIN_OUVERTE ? d : null;
}

export interface ResolveurLegi extends LegiResolver {
  /** Nature du texte, d'après les titres chargés. */
  natureDe(cid: string): string | null;
  /** Date du texte (signature), d'après les titres chargés. */
  dateDe(cid: string): string | null;
  /** CID du texte d'un article déjà rencontré. */
  cidDeLArticle(id: string): string | undefined;
  /** Titres écartés parce que tisseuse ne sait pas les lire. */
  titresEcartes: string[];
}

/**
 * Résolveur adossé à l'index LEGI. Les articles d'un texte sont lus une fois,
 * à la première citation de ce texte, puis gardés en mémoire : un passage cite
 * quelques milliers de textes, pas les 150 000 de l'index.
 */
export function creerResolveur(t: Tisseuse, db: PrismaClient = prisma): ResolveurLegi {
  class Resolveur extends t.LegiResolver implements ResolveurLegi {
    private articlesParCid = new Map<string, Promise<Map<string, VersionArticle[]>>>();
    private cidParArticle = new Map<string, string>();
    private natureParCid = new Map<string, string>();
    private dateParCid = new Map<string, string>();
    private titres: Promise<void> | undefined;
    titresEcartes: string[] = [];

    natureDe(cid: string): string | null {
      return this.natureParCid.get(cid) ?? null;
    }

    dateDe(cid: string): string | null {
      return this.dateParCid.get(cid) ?? null;
    }

    cidDeLArticle(id: string): string | undefined {
      return this.cidParArticle.get(id);
    }

    private articlesDuTexte(cid: string): Promise<Map<string, VersionArticle[]>> {
      let p = this.articlesParCid.get(cid);
      if (!p) {
        p = (async () => {
          const lignes = await db.$queryRaw<VersionArticle[]>`
            SELECT id, num,
              coalesce(date_debut::text, '0001-01-01') AS "dateDebut",
              coalesce(date_fin::text, ${FIN_OUVERTE}) AS "dateFin"
            FROM legi_articles WHERE cid = ${cid} AND num IS NOT NULL`;
          const parNum = new Map<string, VersionArticle[]>();
          for (const l of lignes) {
            this.cidParArticle.set(l.id, cid);
            const versions = parNum.get(l.num);
            if (versions) versions.push(l);
            else parNum.set(l.num, [l]);
          }
          return parNum;
        })();
        this.articlesParCid.set(cid, p);
      }
      return p;
    }

    async getActiveArticlesByTextAndNum({ date, num, textId }: {
      date: string; num: string | undefined; textId: string;
    }): Promise<LegiArticleInfo[]> {
      if (!num) return [];
      const versions = (await this.articlesDuTexte(textId)).get(num) ?? [];
      return versions
        .filter((v) => enVigueur(v, date))
        .map((v) => ({ id: v.id, num: v.num, textId, dateDebut: v.dateDebut, dateFin: v.dateFin }));
    }

    async getDirectSectionChildren(): Promise<LegiSectionInfo[]> {
      return [];
    }

    async getTextIdFromSegmentId(): Promise<string | undefined> {
      return undefined;
    }

    async getUniqueActiveArticlesByNum(): Promise<LegiArticleInfo[]> {
      return [];
    }

    async preloadUniqueActiveArticlesByNums(): Promise<void> {}

    preloadTextTitlesInfos(): Promise<void> {
      this.titres ??= this.chargerTitres();
      return this.titres;
    }

    private async chargerTitres(): Promise<void> {
      const natures = [...t.frenchLawNatures].filter((n) => !NATURES_TITRES_IGNOREES.has(n));
      const lignes = await db.$queryRaw<Array<{
        id: string; cid: string; nature: string; num: string | null;
        dateTexte: string | null; dateDebut: string | null; dateFin: string | null; titre: string;
      }>>`
        SELECT id, cid, nature, num, date_texte::text AS "dateTexte", date_debut::text AS "dateDebut",
          date_fin::text AS "dateFin", titre
        FROM legi_textes WHERE nature = ANY(${natures}::text[]) AND titre <> ''`;
      let rows: TextTitlesInfoRow[] = lignes.map((l) => {
        this.natureParCid.set(l.cid, l.nature);
        // Les codes sont datés de la fin ouverte : pas une date.
        const date = dateTitre(l.dateTexte);
        if (date) this.dateParCid.set(l.cid, date);
        return {
          cid: l.cid, id: l.id, nature: l.nature, num: l.num, title: l.titre,
          dateTexte: dateTitre(l.dateTexte), dateDebut: dateTitre(l.dateDebut), dateFin: l.dateFin,
        };
      });
      // tisseuse 0.21 lève sur le premier titre qu'elle ne sait pas lire au lieu
      // de l'écarter (13 titres sur 150 000) : on l'écarte et on recommence.
      for (;;) {
        try {
          await t.buildAndInstallTextTitlesInfos(rows);
          return;
        } catch (e) {
          const id = /\((\w+TEXT\d+)\): /.exec(String(e))?.[1];
          if (!id || this.titresEcartes.length >= 100) throw e;
          this.titresEcartes.push(id);
          rows = rows.filter((r) => r.id !== id && r.cid !== id);
        }
      }
    }
  }
  return new Resolveur();
}

// =============================================================================
// DÉTECTION
// =============================================================================

/**
 * Texte courant à la fin de l'article amendé : celui que le dispositif modifie
 * quand il cite un article sans nommer le code.
 */
export async function texteCourant(
  t: Tisseuse, resolveur: ResolveurLegi, contenu: string, date: string,
): Promise<TextAstText | undefined> {
  const transformation = t.simplifyPlainText(contenu);
  const context = new t.TextParserContext(transformation.output);
  for await (const _ of t.extractTextLinks({ context, date, legiResolver: resolveur, transformation })) {
    // On ne garde que l'état du contexte.
  }
  // Un texte sans CID (« la présente loi », texte non identifié) n'aide pas.
  return context.currentText?.cid ? context.currentText : undefined;
}

/**
 * Renvois d'un texte, en positions dans ce texte, sans chevauchement.
 *
 * Un texte daté d'après `date` n'existait pas encore : « la loi de finances
 * pour 2026 » d'un amendement déposé en octobre 2025 est le projet en
 * discussion, que tisseuse rattache pourtant, par son titre, à la loi qui en
 * est sortie en février 2026.
 *
 * `texteNomme` ne garde un article que si son texte est nommé dans la
 * citation, ou dans le passage qui l'énumère avec d'autres : sans lui,
 * tisseuse prend le dernier texte cité ou le contexte. C'est juste dans un
 * dispositif, qui modifie un texte à la fois ; faux dans un exposé, où
 * « l'article 3 » désigne le plus souvent un article du texte en discussion
 * (essai du 21/11/2026 : « L'article 19 du PLF » relié à la Constitution
 * citée plus haut).
 */
export async function detecterRenvois(
  t: Tisseuse,
  resolveur: ResolveurLegi,
  { texte, date, contexte, texteNomme = false }: {
    texte: string; date: string; contexte?: TextAstText; texteNomme?: boolean;
  },
): Promise<RenvoiLegi[]> {
  const transformation = t.simplifyPlainText(texte);
  const context = new t.TextParserContext(transformation.output);
  context.currentText = contexte;
  const renvois: RenvoiLegi[] = [];
  for await (const lien of t.extractTextLinks({ context, date, legiResolver: resolveur, transformation })) {
    const position = lien.originalTransformation?.position;
    if (!position) continue;
    let renvoi: RenvoiLegi | undefined;
    if (lien.type === 'external_article' && lien.articleId) {
      if (texteNomme && lien.article.implicitText) continue;
      const cid = resolveur.cidDeLArticle(lien.articleId);
      if (cid) {
        renvoi = {
          debut: position.start, fin: position.stop, type: 'article', article: lien.articleId,
          cid, nature: resolveur.natureDe(cid),
        };
      }
    } else if (lien.type === 'external_text' && lien.text.cid) {
      const cid = lien.text.cid;
      const dateTexte = resolveur.dateDe(cid);
      if (dateTexte && dateTexte > date) continue;
      renvoi = { debut: position.start, fin: position.stop, type: 'texte', cid, nature: resolveur.natureDe(cid) };
    }
    if (renvoi && renvoi.fin > renvoi.debut) renvois.push(renvoi);
  }
  return sansChevauchement(renvois);
}

/**
 * Un lien ne peut pas en contenir un autre : à recouvrement, le plus précis
 * (l'article plutôt que son texte), puis le premier, l'emporte.
 */
export function sansChevauchement(renvois: RenvoiLegi[]): RenvoiLegi[] {
  const tries = [...renvois].sort(
    (a, b) => (a.type === b.type ? 0 : a.type === 'article' ? -1 : 1) || a.debut - b.debut,
  );
  const gardes: RenvoiLegi[] = [];
  for (const r of tries) {
    if (gardes.every((g) => r.fin <= g.debut || r.debut >= g.fin)) gardes.push(r);
  }
  return gardes.sort((a, b) => a.debut - b.debut);
}

// =============================================================================
// AMENDEMENTS
// =============================================================================

interface AmendementATraiter {
  id: string;
  /** NULL pour une ligne de renvois dont l'amendement a perdu son dispositif. */
  dispositif: string | null;
  expose: string | null;
  date: string | null;
  texteRef: string | null;
  articleVise: string | null;
}

/**
 * Quels amendements un lot ramène :
 *  - `courant` : jamais traités, modifiés depuis, dont le texte amendé a reçu
 *    ses articles depuis, ou trop récents pour que la DILA ait tout
 *    consolidé ;
 *  - `rattrapage` : les autres, calculés par une version antérieure de la
 *    détection ;
 *  - `tout` : tous.
 */
type Selection = 'courant' | 'rattrapage' | 'tout';

/**
 * Amendements à (re)calculer, selon la sélection.
 *
 * Le passage courant ramène aussi, sans dispositif, les amendements calculés
 * dont le dispositif a disparu depuis (107 à l'Assemblée le 11/11/2026) :
 * leurs renvois pointent dans un texte qui n'existe plus, la ligne est
 * effacée.
 */
async function lireLot(apres: string, selection: Selection, uid?: string): Promise<AmendementATraiter[]> {
  const tout = selection === 'tout';
  const rattrapage = selection === 'rattrapage';
  return prisma.$queryRaw<AmendementATraiter[]>`
    SELECT a.id, a.dispositif, a.expose_sommaire AS expose, a.date_depot::date::text AS date,
      a.texte_ref AS "texteRef", a.article_vise AS "articleVise"
    FROM amendements a
    LEFT JOIN amendements_renvois r ON r.amendement_id = a.id
    WHERE a.id > ${apres}
      AND (${uid ?? null}::text IS NULL OR a.uid = ${uid ?? null})
      AND (
        NOT ${rattrapage} AND (a.dispositif IS NULL OR a.date_depot IS NULL) AND r.amendement_id IS NOT NULL
        OR a.dispositif IS NOT NULL AND a.date_depot IS NOT NULL AND (
          ${tout}
          OR ${rattrapage} AND r.version < ${VERSION_DETECTION}
          OR NOT ${rattrapage} AND (
            r.amendement_id IS NULL
            OR a.updated_at > r.calcule_le
            OR a.date_depot > now() - make_interval(days => ${JOURS_RECALCUL_RECENTS}::int)
            OR EXISTS (
              SELECT 1 FROM textes_articles ta WHERE ta.texte_ref = a.texte_ref AND ta.created_at > r.calcule_le)
          )
        )
      )
    ORDER BY a.id
    LIMIT ${TAILLE_LOT}`;
}

interface LigneRenvois {
  amendementId: string;
  renvois: RenvoiLegi[];
  renvoisExpose: RenvoiLegi[];
}

async function ecrireLot(lignes: LigneRenvois[]): Promise<void> {
  if (lignes.length === 0) return;
  // Un seul paramètre JSON (cf. workers/index-legi.ts).
  await prisma.$executeRaw`
    INSERT INTO amendements_renvois (amendement_id, version, renvois, renvois_expose)
    SELECT "amendementId", ${VERSION_DETECTION}, renvois, "renvoisExpose"
    FROM json_to_recordset(${JSON.stringify(lignes)}::json)
      AS x("amendementId" text, renvois jsonb, "renvoisExpose" jsonb)
    ON CONFLICT (amendement_id) DO UPDATE SET version = EXCLUDED.version, renvois = EXCLUDED.renvois,
      renvois_expose = EXCLUDED.renvois_expose, calcule_le = now()`;
}

async function effacerLot(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.$executeRaw`DELETE FROM amendements_renvois WHERE amendement_id = ANY(${ids}::text[])`;
}

/**
 * Article du projet amendé, s'il est en base (AN, amendement sur l'article
 * même) : sa clé par amendement, et son contenu par clé. Un article porte
 * parfois des milliers d'amendements (l'article 49 d'un PLF) : il n'est
 * analysé qu'une fois.
 */
async function articlesAmendes(lot: AmendementATraiter[]): Promise<{
  cleParAmendement: Map<string, string>;
  contenuParCle: Map<string, string>;
}> {
  const voulus = new Map<string, string[]>();
  for (const a of lot) {
    if (!a.texteRef || !a.articleVise) continue;
    const vise = articleKeyFromArticleVise(a.articleVise);
    if (!vise || vise.apres) continue;
    voulus.set(a.id, articleLookupKeys(vise.key).map((k) => `${a.texteRef}|${k}`));
  }
  const cleParAmendement = new Map<string, string>();
  const contenuParCle = new Map<string, string>();
  if (voulus.size === 0) return { cleParAmendement, contenuParCle };
  const texteRefs = [...new Set(lot.flatMap((a) => (voulus.has(a.id) ? [a.texteRef!] : [])))];
  const articles = await prisma.texteArticle.findMany({
    where: { texteRef: { in: texteRefs } },
    select: { texteRef: true, numero: true, contenu: true },
  });
  for (const a of articles) contenuParCle.set(`${a.texteRef}|${a.numero}`, a.contenu);
  for (const [id, cles] of voulus) {
    const cle = cles.find((c) => contenuParCle.has(c));
    if (cle) cleParAmendement.set(id, cle);
  }
  return { cleParAmendement, contenuParCle };
}

export interface RenvoisLegiOptions {
  /** Nombre maximum d'amendements traités. */
  limite?: number;
  /** Tout recalculer, même ce qui est à jour. */
  tout?: boolean;
  /**
   * Nombre maximum d'amendements d'une version antérieure de la détection
   * repris après le passage courant (`RATTRAPAGE_PAR_PASSAGE` par défaut,
   * 0 pour aucun). Sans effet avec `tout`.
   */
  rattrapage?: number;
  /** Ne traiter que cet amendement (uid). */
  uid?: string;
  /** Calculer sans écrire. */
  dryRun?: boolean;
}

interface CompteRenvois {
  /** Amendements avec au moins un lien dans ce texte. */
  avecRenvoi: number;
  renvois: { article: number; texte: number };
}

export interface RenvoisLegiResultat extends CompteRenvois {
  amendements: number;
  /** Dont amendements d'une version antérieure, repris par le rattrapage. */
  rattrapes: number;
  /** Les mêmes comptes, pour l'exposé sommaire. */
  expose: CompteRenvois;
  avecContexte: number;
  erreurs: number;
  titresEcartes: number;
  /** Lignes effacées : amendements qui n'ont plus de dispositif. */
  effaces: number;
}

function compter(compte: CompteRenvois, renvois: RenvoiLegi[]): void {
  if (renvois.length) compte.avecRenvoi++;
  for (const r of renvois) compte.renvois[r.type]++;
}

export async function synchroniserRenvoisLegi(options: RenvoisLegiOptions = {}): Promise<RenvoisLegiResultat> {
  const t: Tisseuse = await import('@tricoteuses/tisseuse');
  const resolveur = creerResolveur(t);
  const debut = Date.now();
  await resolveur.preloadTextTitlesInfos();
  logger.info({ ms: Date.now() - debut, titresEcartes: resolveur.titresEcartes }, 'Renvois LEGI : titres chargés');

  const resultat: RenvoisLegiResultat = {
    amendements: 0, rattrapes: 0, avecRenvoi: 0, renvois: { article: 0, texte: 0 },
    expose: { avecRenvoi: 0, renvois: { article: 0, texte: 0 } },
    avecContexte: 0, erreurs: 0, titresEcartes: resolveur.titresEcartes.length, effaces: 0,
  };
  // Texte courant de chaque article amendé, calculé une fois par article.
  const contextes = new Map<string, Promise<TextAstText | undefined>>();

  /** Un passage sur la sélection, `limite` amendements au plus. */
  const passer = async (selection: Selection, limite: number): Promise<number> => {
    let traites = 0;
    let apres = '';
    for (;;) {
      const restant = Math.min(limite - traites, (options.limite ?? Infinity) - resultat.amendements);
      if (restant <= 0) break;
      const lus = (await lireLot(apres, selection, options.uid)).slice(0, restant);
      if (lus.length === 0) break;
      apres = lus.at(-1)!.id;
      const aEffacer = lus.filter((a) => a.dispositif === null || a.date === null).map((a) => a.id);
      const lot = lus.filter((a): a is AmendementATraiter & { dispositif: string; date: string } =>
        a.dispositif !== null && a.date !== null);

      const { cleParAmendement, contenuParCle } = await articlesAmendes(lot);
      const lignes: LigneRenvois[] = [];
      for (const a of lot) {
        try {
          const cle = cleParAmendement.get(a.id);
          let contexte: TextAstText | undefined;
          if (cle) {
            let p = contextes.get(cle);
            if (!p) {
              p = texteCourant(t, resolveur, contenuParCle.get(cle)!, a.date);
              contextes.set(cle, p);
            }
            contexte = await p;
            if (contexte) resultat.avecContexte++;
          }
          const renvois = await detecterRenvois(t, resolveur, { texte: a.dispositif, date: a.date, contexte });
          const renvoisExpose = a.expose
            ? await detecterRenvois(t, resolveur, { texte: a.expose, date: a.date, contexte, texteNomme: true })
            : [];
          lignes.push({ amendementId: a.id, renvois, renvoisExpose });
          compter(resultat, renvois);
          compter(resultat.expose, renvoisExpose);
        } catch (e) {
          // Un texte que la grammaire ne sait pas lire ne bloque pas les autres.
          resultat.erreurs++;
          logger.warn({ amendementId: a.id, erreur: String(e).slice(0, 300) }, 'Renvois LEGI : texte illisible');
        }
      }
      if (!options.dryRun) {
        await ecrireLot(lignes);
        await effacerLot(aEffacer);
      }
      resultat.effaces += aEffacer.length;
      resultat.amendements += lot.length;
      traites += lus.length;
      if (selection === 'rattrapage') resultat.rattrapes += lot.length;
      if (resultat.amendements % 10_000 < TAILLE_LOT) {
        logger.info({ ...resultat, ms: Date.now() - debut }, 'Renvois LEGI : avancement');
      }
    }
    return traites;
  };

  if (options.tout) {
    await passer('tout', Infinity);
  } else {
    await passer('courant', Infinity);
    await passer('rattrapage', options.rattrapage ?? RATTRAPAGE_PAR_PASSAGE);
  }
  return resultat;
}
