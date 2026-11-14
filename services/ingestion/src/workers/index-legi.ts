// =============================================================================
// Worker — Index de la base LEGI (DILA)
// =============================================================================
//
// Tient `legi_textes` et `legi_articles` : de quoi reconnaître un texte cité
// dans un amendement et pointer l'article visé sur Légifrance, dans sa version
// en vigueur à la date de l'amendement (T5, ticket #46). Pas de contenu
// juridique : identifiants, numéros, dates, titres.
//
// Premier passage : le dump global de la DILA, puis tous ses incréments.
// Mesuré le 26/10/2026 sur un portable : 14 min en tout, dont 4 de
// téléchargement du dump (1,1 Go), 1 min 30 pour l'écrire et 9 min pour les
// 476 incréments ; 900 Mo de mémoire au plus. Résultat : 154 276 versions de
// textes, 734 257 versions d'articles, 250 Mo dans Postgres, index compris. Ensuite, chaque nuit, les seuls
// incréments publiés depuis le dernier appliqué, noté dans `source_states`
// (dila / legi). Un incrément s'applique en une transaction, son état
// compris : un passage interrompu reprend à l'incrément qui a échoué.
//
// Ordre dans un incrément : les suppressions d'abord, puis les ajouts. Un
// fichier qui change de chemin figure dans les deux, dans le même incrément :
// appliquer les suppressions après effacerait ce qui vient d'arriver. Les
// déplacements de dossiers entiers ne retirent rien (sources/dila/legi-client.ts).
//
// Mesuré sur les incréments du 13/07/2025 au 24/10/2026 : environ un par jour
// ouvré, quelques Mo chacun, et la DILA en saute parfois un (7 jours manqués
// en 15 mois) sans que rien ne manque ensuite.
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import {
  URL_LEGI,
  horodatageArchive,
  listerArchivesLegi,
  parcourirArchiveLegi,
  type ArticleLegi,
  type ElementLegi,
  type SuppressionLegi,
  type VersionTexteLegi,
} from '../sources/dila/legi-client.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

const SOURCE = 'dila';
const DATA_TYPE = 'legi';

/**
 * Natures dont on garde les titres : les textes français que la grammaire de
 * tisseuse sait reconnaître (`frenchLawNatures` de @tricoteuses/tisseuse
 * 0.21), plus la Déclaration des droits de l'homme (DECLARATION), du bloc de
 * constitutionnalité. Les avis, délibérations, accords… ne sont pas cités
 * comme des textes de loi.
 */
export const NATURES_TITRES: ReadonlySet<string> = new Set([
  'ARRETE', 'CIRCULAIRE', 'CODE', 'CONSTITUTION', 'DECLARATION', 'DECRET', 'DECRET_LOI', 'LOI',
  'LOI_CONSTIT', 'LOI_ORGANIQUE', 'ORDONNANCE',
]);

/**
 * Natures dont on garde les articles. Sans les arrêtés ni les circulaires, que
 * les amendements ne citent presque jamais à l'article, et qui pèsent près de
 * 500 000 versions d'articles à eux seuls : un renvoi à un arrêté mène au texte.
 */
export const NATURES_ARTICLES: ReadonlySet<string> = new Set([
  'CODE', 'CONSTITUTION', 'DECLARATION', 'DECRET', 'DECRET_LOI', 'LOI', 'LOI_CONSTIT', 'LOI_ORGANIQUE',
  'ORDONNANCE',
]);

/**
 * Une version d'article sortie de vigueur avant cette date ne peut être celle
 * d'aucun amendement en base : ils commencent en juin 2017 (15e législature).
 */
export const FIN_DE_VIGUEUR_MIN = '2017-01-01';

/** Lignes écrites par requête : assez pour amortir l'aller-retour, assez peu pour les paramètres. */
const TAILLE_LOT = 5_000;

export function articleRetenu(a: ArticleLegi): boolean {
  // Nature inconnue (article sans contexte) : gardé, la date tranche.
  if (a.natureTexte !== null && !NATURES_ARTICLES.has(a.natureTexte)) return false;
  // Sans date de fin connue, on garde : mieux vaut une ligne de trop qu'un lien manquant.
  return a.dateFin === null || a.dateFin >= FIN_DE_VIGUEUR_MIN;
}

export function texteRetenu(t: VersionTexteLegi): boolean {
  return NATURES_TITRES.has(t.nature);
}

export interface IndexLegiOptions {
  /** Nombre maximum d'incréments appliqués lors de ce passage. */
  limite?: number;
  /** Vider l'index et repartir du dernier dump global. */
  reinitialiser?: boolean;
  /**
   * Charger le dump global si l'index n'a jamais été chargé (défaut : oui).
   * Le batch de nuit passe `false` : 1,1 Go à télécharger n'a rien à faire
   * dans le cron, le premier chargement se lance à la main.
   */
  chargerGlobalSiVide?: boolean;
}

export interface IndexLegiResultat {
  /** Dump global chargé lors de ce passage, s'il y en a eu un. */
  global: string | null;
  incrementsAppliques: number;
  incrementsRestants: number;
  /** Dernière archive appliquée (horodatage DILA). */
  archive: string | null;
  textesEcrits: number;
  articlesEcrits: number;
  lignesSupprimees: number;
}

// =============================================================================
// ÉCRITURE
// =============================================================================

type Client = PrismaClient | Prisma.TransactionClient;

// Les lots partent en un seul paramètre JSON, lu par `json_to_recordset`. Avec
// un tableau par colonne (`unnest`), Prisma déduit le type de chaque tableau de
// ses valeurs : un lot dont une colonne n'est faite que de NULL (aucun numéro,
// par exemple) envoie un autre type que la requête préparée au lot précédent,
// et Postgres le refuse (« improper binary format in array element 1 »).

/** Dernière occurrence de chaque identifiant : `ON CONFLICT` refuse deux fois la même ligne. */
function dedoublonner<T extends { id: string }>(lignes: T[]): T[] {
  return [...new Map(lignes.map((l) => [l.id, l])).values()];
}

async function ecrireTextes(db: Client, lignes: VersionTexteLegi[]): Promise<number> {
  const l = dedoublonner(lignes);
  if (l.length === 0) return 0;
  return db.$executeRaw`
    INSERT INTO legi_textes (id, cid, nature, num, date_texte, date_debut, date_fin, etat, titre)
    SELECT id, cid, nature, num, "dateTexte", "dateDebut", "dateFin", etat, titre
    FROM json_to_recordset(${JSON.stringify(l)}::json) AS x(
      id text, cid text, nature text, num text, "dateTexte" date, "dateDebut" date, "dateFin" date,
      etat text, titre text)
    ON CONFLICT (id) DO UPDATE SET
      cid = EXCLUDED.cid, nature = EXCLUDED.nature, num = EXCLUDED.num, date_texte = EXCLUDED.date_texte,
      date_debut = EXCLUDED.date_debut, date_fin = EXCLUDED.date_fin, etat = EXCLUDED.etat,
      titre = EXCLUDED.titre`;
}

async function ecrireArticles(db: Client, lignes: ArticleLegi[]): Promise<number> {
  const l = dedoublonner(lignes);
  if (l.length === 0) return 0;
  return db.$executeRaw`
    INSERT INTO legi_articles (id, cid, num, etat, date_debut, date_fin)
    SELECT id, cid, num, etat, "dateDebut", "dateFin"
    FROM json_to_recordset(${JSON.stringify(l)}::json) AS x(
      id text, cid text, num text, etat text, "dateDebut" date, "dateFin" date)
    ON CONFLICT (id) DO UPDATE SET
      cid = EXCLUDED.cid, num = EXCLUDED.num, etat = EXCLUDED.etat, date_debut = EXCLUDED.date_debut,
      date_fin = EXCLUDED.date_fin`;
}

/** Retire les articles et versions de textes que l'incrément supprime ou que le filtre écarte. */
async function supprimer(db: Client, suppressions: SuppressionLegi[], articlesEcartes: string[]): Promise<number> {
  const articles = [
    ...suppressions.flatMap((s) => (s.type === 'article' ? [s.id] : [])),
    ...articlesEcartes,
  ];
  const versions = suppressions.flatMap((s) => (s.type === 'version_texte' ? [s.id] : []));
  let n = 0;
  if (articles.length) n += await db.$executeRaw`DELETE FROM legi_articles WHERE id = ANY(${articles}::text[])`;
  if (versions.length) n += await db.$executeRaw`DELETE FROM legi_textes WHERE id = ANY(${versions}::text[])`;
  return n;
}

async function noterArchive(db: Client, archive: string, nom: string, global: string | null): Promise<void> {
  const now = new Date();
  // `archive` (horodatage DILA, heure de Paris) est le point de reprise.
  const metadata: Prisma.InputJsonValue = { archive, nom, ...(global ? { global } : {}) };
  await db.sourceState.upsert({
    where: { source_dataType: { source: SOURCE, dataType: DATA_TYPE } },
    create: {
      source: SOURCE, dataType: DATA_TYPE, resourceUrl: URL_LEGI, lastSyncAt: now, lastCheckAt: now, metadata,
    },
    update: { resourceUrl: URL_LEGI, lastSyncAt: now, lastCheckAt: now, metadata },
  });
}

// =============================================================================
// ARCHIVES
// =============================================================================

/** Le dump global, en flux : écrit par lots, sans transaction (il n'a pas de suppressions). */
async function chargerGlobal(nom: string): Promise<{ textes: number; articles: number }> {
  let textes: VersionTexteLegi[] = [];
  let articles: ArticleLegi[] = [];
  const total = { textes: 0, articles: 0 };
  let vus = 0;
  const vider = async () => {
    total.textes += await ecrireTextes(prisma, textes);
    total.articles += await ecrireArticles(prisma, articles);
    textes = [];
    articles = [];
  };
  await parcourirArchiveLegi(nom, async (e: ElementLegi) => {
    if (e.type === 'texte' && texteRetenu(e.texte)) textes.push(e.texte);
    if (e.type === 'article') {
      if (++vus % 200_000 === 0) logger.info({ articlesLus: vus, ...total }, 'Dump LEGI global : chargement…');
      if (articleRetenu(e.article)) articles.push(e.article);
    }
    if (textes.length + articles.length >= TAILLE_LOT) await vider();
  });
  await vider();
  return total;
}

/** Un incrément : lu en entier (quelques Mo), puis appliqué en une transaction avec l'état. */
async function appliquerIncrement(
  nom: string,
): Promise<{ textes: number; articles: number; supprimees: number }> {
  const textes: VersionTexteLegi[] = [];
  const articles: ArticleLegi[] = [];
  // Article qui ne passe plus le filtre (nature, fin de vigueur) : sa version
  // précédente, s'il y en a une, doit partir aussi.
  const articlesEcartes: string[] = [];
  const suppressions: SuppressionLegi[] = [];
  await parcourirArchiveLegi(nom, (e) => {
    if (e.type === 'texte') {
      if (texteRetenu(e.texte)) textes.push(e.texte);
    } else if (e.type === 'article') {
      if (articleRetenu(e.article)) articles.push(e.article);
      else articlesEcartes.push(e.article.id);
    } else {
      suppressions.push(e.chemin);
    }
  });

  return prisma.$transaction(
    async (tx) => {
      const supprimees = await supprimer(tx, suppressions, articlesEcartes);
      let t = 0;
      let a = 0;
      for (let i = 0; i < textes.length; i += TAILLE_LOT) t += await ecrireTextes(tx, textes.slice(i, i + TAILLE_LOT));
      for (let i = 0; i < articles.length; i += TAILLE_LOT) a += await ecrireArticles(tx, articles.slice(i, i + TAILLE_LOT));
      await noterArchive(tx, horodatageArchive(nom), nom, null);
      return { textes: t, articles: a, supprimees };
    },
    // Un incrément exceptionnel (refonte d'un code) peut peser des dizaines de
    // milliers de lignes : le défaut de 5 s ne suffirait pas.
    { timeout: 300_000, maxWait: 30_000 },
  );
}

// =============================================================================
// POINT D'ENTRÉE
// =============================================================================

export async function synchroniserIndexLegi(options: IndexLegiOptions = {}): Promise<IndexLegiResultat> {
  const { globaux, increments } = await listerArchivesLegi();
  const etat = await prisma.sourceState.findUnique({
    where: { source_dataType: { source: SOURCE, dataType: DATA_TYPE } },
  });
  let archive = (etat?.metadata as { archive?: string } | null)?.archive ?? null;
  const resultat: IndexLegiResultat = {
    global: null, incrementsAppliques: 0, incrementsRestants: 0, archive,
    textesEcrits: 0, articlesEcrits: 0, lignesSupprimees: 0,
  };

  if (!archive && options.chargerGlobalSiVide === false && !options.reinitialiser) {
    throw new Error('Index LEGI jamais chargé : lancer `sync-index-legi` à la main (dump global de 1,1 Go).');
  }
  if (!archive || options.reinitialiser) {
    const global = globaux.at(-1);
    if (!global) throw new Error(`Aucun dump global LEGI listé sur ${URL_LEGI}`);
    if (options.reinitialiser) {
      await prisma.$executeRaw`TRUNCATE legi_textes, legi_articles`;
      logger.info('Index LEGI vidé avant rechargement');
    }
    logger.info({ global }, 'Index LEGI : chargement du dump global');
    const { textes, articles } = await chargerGlobal(global);
    archive = horodatageArchive(global);
    await noterArchive(prisma, archive, global, global);
    Object.assign(resultat, { global, archive, textesEcrits: textes, articlesEcrits: articles });
    logger.info({ global, textes, articles }, 'Index LEGI : dump global chargé');
  }

  // Les incréments n'ont de sens qu'enchaînés au point où l'index s'est
  // arrêté. Si la DILA a publié un nouveau global et retiré les incréments
  // de l'ancien, il manquerait des suppressions : on s'arrête plutôt que de
  // tenir un index faux sans le savoir.
  const depart = archive;
  const enchaine =
    increments.some((n) => horodatageArchive(n) <= depart) ||
    globaux.some((n) => horodatageArchive(n) === depart);
  if (!enchaine) {
    throw new Error(
      `Index LEGI arrêté à ${depart}, que les archives listées ne prolongent plus : ` +
        `relancer \`sync-index-legi --reinitialiser\` pour repartir du dernier dump global.`,
    );
  }

  const aAppliquer = increments.filter((n) => horodatageArchive(n) > depart);
  const lot = options.limite !== undefined ? aAppliquer.slice(0, options.limite) : aAppliquer;
  for (const nom of lot) {
    const r = await appliquerIncrement(nom);
    resultat.incrementsAppliques++;
    resultat.textesEcrits += r.textes;
    resultat.articlesEcrits += r.articles;
    resultat.lignesSupprimees += r.supprimees;
    resultat.archive = horodatageArchive(nom);
    logger.info({ increment: nom, ...r }, 'Index LEGI : incrément appliqué');
  }
  resultat.incrementsRestants = aAppliquer.length - lot.length;
  if (lot.length === 0 && etat) {
    await prisma.sourceState.update({
      where: { source_dataType: { source: SOURCE, dataType: DATA_TYPE } },
      data: { lastCheckAt: new Date() },
    });
  }
  return resultat;
}
