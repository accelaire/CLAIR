// =============================================================================
// Rattachement des débats du Sénat à leurs scrutins
// =============================================================================
//
// L'Assemblée publie ses proclamations : « Je mets aux voix … », puis les
// chiffres du scrutin. Rapprocher un débat de son vote y revient à apparier ces
// chiffres, une clé quasi unique. Le compte rendu du Sénat que nous ingérons ne
// contient rien de tel — il ne garde que la parole des orateurs, jamais celle
// du plateau : sur 91 017 interventions, une seule dit « je mets aux voix » et
// aucune ne porte de décompte.
//
// Il faut donc rapprocher par le SUJET, ce que les deux bords disent examiner :
//
//   - le libellé du scrutin, qui nomme toujours sa cible (`scrutin-titre`) ;
//   - la section de discussion du débat, qui nomme l'article et énumère les
//     amendements (`debats-index-client`).
//
// Et borner au TEXTE, sans quoi le rapprochement est faux : une journée de
// séance discute jusqu'à six textes, et 283 des 716 rattachements mesurés sans
// cette borne mêlaient les débats de plusieurs d'entre eux. La borne vient de
// `lectures-client`, qui relie une section au dossier législatif.
//
// Mesuré sur les 812 scrutins que couvrent nos comptes rendus (16/01/2024 →
// 21/07/2026) : 799 rattachés, soit 98,4 %.
// =============================================================================

import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import {
  SenatDebatsIndexClient,
  type SectionDebatSenat,
} from '../sources/senat/debats-index-client';
import { SenatLecturesClient } from '../sources/senat/lectures-client';
import {
  lireTitreScrutinSenat,
  cleArticleSenat,
  type CibleDuScrutinSenat,
} from '../sources/senat/scrutin-titre';

const prisma = new PrismaClient();

/**
 * Ce qu'on écrit dans `via`, de la lecture la plus fine à la plus large.
 *
 * `amendement` nomme l'amendement voté, `article` la discussion de l'article,
 * `ensemble` les explications de vote, `motion` la section de la motion, et
 * `finances` le fascicule budgétaire — le plus large, un texte de finances ne
 * se discutant pas par articles.
 */
export const VIA_SENAT = ['amendement', 'article', 'ensemble', 'motion', 'finances'] as const;
export type ViaSenat = (typeof VIA_SENAT)[number];

/**
 * Les quatre genres de motion du Sénat, tels que son index les type.
 *
 * `question` est la question PRÉALABLE, une motion — et non une question orale,
 * que l'index range sous `question_orale`.
 */
const SECTIONS_DE_MOTION = new Set(['motion', 'question', 'excirrec', 'renvcomm']);

/** Sections d'un texte budgétaire, qui ne se discute pas par articles. */
const SECTIONS_DE_FINANCES = new Set([
  'finances_fascicule',
  'finances_premierepartie',
  'finances_deuxiemepartie',
  'finances_nonrattaches',
]);

const SECTION_DISCUSSION_ARTICLE = '1';
const SECTION_DISCUSSION_GENERALE = '0';
const SECTION_EXPLICATIONS_DE_VOTE = '2';

export interface OptionsLinkDebatsSenat {
  depuisAnnee?: number;
  dryRun?: boolean;
  /** Écrit les liens dans un fichier TSV au lieu de la base, pour contre-épreuve. */
  sortie?: string;
  /** Rejoue les scrutins déjà rattachés — à n'utiliser que si la règle a changé. */
  refaireTout?: boolean;
  cheminDebats?: string;
  cheminDosleg?: string;
}

export interface ResultatLinkDebatsSenat {
  sections: number;
  scrutins: number;
  scrutinsIgnores: number;
  rattaches: number;
  sansDebat: number;
  /**
   * Scrutins dont on a bien trouvé la section, mais dont aucune prise de
   * parole n'existe dans notre corpus — le compte rendu de ce jour n'a pas été
   * ingéré, ou la section ne contient aucune intervention. Les compter à part
   * évite de présenter comme rattaché un scrutin qui n'affichera rien.
   */
  rattachesSansIntervention: number;
  liens: number;
  parVia: Record<string, number>;
}

interface ScrutinARattacher {
  id: string;
  date: string;
  titre: string;
  dossierId: string | null;
}

interface LienSenat {
  date: string;
  ancre: string;
  scrutinId: string;
  via: ViaSenat;
}

// =============================================================================
// CHOIX DES SECTIONS
// =============================================================================

/**
 * Les sections qui portent le débat d'un scrutin, et la finesse du lien.
 *
 * L'ordre des essais est la règle. Pour un vote sur amendement on cherche
 * d'abord son numéro dans les énumérations de section — le seul lien nominatif
 * dont on dispose — puis, à défaut, la discussion de l'article qu'il vise, puis
 * le fascicule budgétaire qui accueille les amendements de finances.
 */
export function sectionsDuScrutin(
  objet: ReturnType<typeof lireTitreScrutinSenat>,
  duTexte: SectionDebatSenat[],
): { sections: SectionDebatSenat[]; via: ViaSenat } | null {
  const parArticle = (): SectionDebatSenat[] => {
    const cle = cleArticleSenat(objet.article);
    if (!cle) return [];
    return duTexte.filter(
      (s) => s.typeSection === SECTION_DISCUSSION_ARTICLE && s.articles.includes(cle),
    );
  };
  const duType = (types: Set<string> | string): SectionDebatSenat[] =>
    duTexte.filter((s) =>
      typeof types === 'string' ? s.typeSection === types : types.has(s.typeSection),
    );

  const essais: Record<CibleDuScrutinSenat, () => { sections: SectionDebatSenat[]; via: ViaSenat }[]> = {
    amendement: () => [
      { sections: parNumero(objet.numeros, duTexte), via: 'amendement' },
      { sections: parArticle(), via: 'article' },
      { sections: duType(SECTIONS_DE_FINANCES), via: 'finances' },
    ],
    'sous-amendement': () => [
      { sections: parNumero(objet.numeros, duTexte), via: 'amendement' },
      { sections: parArticle(), via: 'article' },
      { sections: duType(SECTIONS_DE_FINANCES), via: 'finances' },
    ],
    article: () => [{ sections: parArticle(), via: 'article' }],
    // Le Sénat n'explique pas toujours son vote : à défaut, la discussion
    // générale du texte est bien ce qui a précédé le vote sur l'ensemble.
    ensemble: () => [
      { sections: duType(SECTION_EXPLICATIONS_DE_VOTE), via: 'ensemble' },
      { sections: duType(SECTION_DISCUSSION_GENERALE), via: 'ensemble' },
    ],
    motion: () => [{ sections: duType(SECTIONS_DE_MOTION), via: 'motion' }],
    credits: () => [{ sections: duType(SECTIONS_DE_FINANCES), via: 'finances' }],
    // Une déclaration du Gouvernement n'a pas de texte, donc pas de section
    // propre ; on renonce plutôt que de rattacher la séance entière.
    declaration: () => [],
    autre: () => [],
  };

  for (const essai of essais[objet.cible]()) {
    if (essai.sections.length > 0) return essai;
  }
  return null;
}

/** Sections dont la désignation énumère l'un des numéros votés. */
function parNumero(numeros: string[], duTexte: SectionDebatSenat[]): SectionDebatSenat[] {
  if (numeros.length === 0) return [];
  return duTexte.filter((s) => s.amendements.some((a) => numeros.includes(a)));
}

// =============================================================================
// WORKER
// =============================================================================

export async function linkDebatsScrutinsSenat(
  options: OptionsLinkDebatsSenat = {},
): Promise<ResultatLinkDebatsSenat> {
  const depuisAnnee = options.depuisAnnee ?? 2024;
  logger.info(
    { depuisAnnee, dryRun: options.dryRun ?? false, sortie: options.sortie },
    'Rattachement des débats du Sénat aux scrutins...',
  );

  const sections = await new SenatDebatsIndexClient().sections({
    depuisAnnee,
    cheminLocal: options.cheminDebats,
  });
  const lectures = await new SenatLecturesClient().lecturesVersDossier({
    cheminLocal: options.cheminDosleg,
  });
  const dossiers = await dossiersParUid();

  // Chaque section est rapportée aux dossiers dont elle relève, puis indexée
  // par jour : c'est ainsi qu'on la retrouvera depuis un scrutin.
  const parJour = new Map<string, SectionDebatSenat[]>();
  const dossiersDeLaSection = new Map<string, Set<string>>();
  for (const section of sections) {
    const ids = new Set<string>();
    for (const lecture of section.lectures) {
      const uid = lectures.get(lecture);
      const id = uid ? dossiers.get(uid) : undefined;
      if (id) ids.add(id);
    }
    dossiersDeLaSection.set(section.cle, ids);
    const jour = parJour.get(section.date);
    if (jour) jour.push(section);
    else parJour.set(section.date, [section]);
  }

  const scrutins = await scrutinsARattacher(sections, options.refaireTout ?? false);
  const resultat: ResultatLinkDebatsSenat = {
    sections: sections.length,
    scrutins: scrutins.retenus.length,
    scrutinsIgnores: scrutins.ignores,
    rattaches: 0,
    sansDebat: 0,
    rattachesSansIntervention: 0,
    liens: 0,
    parVia: {},
  };

  const liens: LienSenat[] = [];
  for (const scrutin of scrutins.retenus) {
    const objet = lireTitreScrutinSenat(scrutin.titre);
    const duJour = parJour.get(scrutin.date) ?? [];
    // Sans dossier connu, on ne sait pas de quel texte le scrutin relève : le
    // rattacher au débat du jour reviendrait à prendre celui d'un autre texte.
    const duTexte = scrutin.dossierId
      ? duJour.filter((s) => dossiersDeLaSection.get(s.cle)?.has(scrutin.dossierId!))
      : [];

    const choix = duTexte.length > 0 ? sectionsDuScrutin(objet, duTexte) : null;
    if (!choix) {
      resultat.sansDebat++;
      continue;
    }

    resultat.rattaches++;
    resultat.parVia[choix.via] = (resultat.parVia[choix.via] ?? 0) + 1;
    for (const section of choix.sections) {
      for (const ancre of section.ancres) {
        liens.push({ date: section.date, ancre, scrutinId: scrutin.id, via: choix.via });
      }
    }
  }

  resultat.liens = liens.length;

  if (options.dryRun) {
    logger.info(resultat, 'Rattachement des débats du Sénat (à blanc)');
    return resultat;
  }

  const { ecrits, scrutinsServis } = options.sortie
    ? await ecrireFichier(liens, options.sortie)
    : await ecrireEnBase(liens);
  resultat.liens = ecrits;
  resultat.rattachesSansIntervention = resultat.rattaches - scrutinsServis.size;

  logger.info(resultat, 'Rattachement des débats du Sénat terminé');
  return resultat;
}

/** `uid` → identifiant interne, pour les dossiers du Sénat. */
async function dossiersParUid(): Promise<Map<string, string>> {
  const lignes = await prisma.$queryRaw<{ id: string; uid: string }[]>`
    SELECT id, uid FROM dossiers_legislatifs WHERE uid LIKE 'SENAT-%'
  `;
  return new Map(lignes.map((l) => [l.uid, l.id]));
}

/**
 * Les scrutins du Sénat que le corpus de comptes rendus peut couvrir.
 *
 * La fenêtre est celle des sections elles-mêmes : nos comptes rendus ne
 * remontent pas au-delà, et 3 963 des 4 775 scrutins du Sénat précèdent le
 * corpus. Les borner ici évite de compter comme des échecs des scrutins qu'on
 * n'a jamais eu les moyens de rattacher.
 */
async function scrutinsARattacher(
  sections: SectionDebatSenat[],
  refaireTout: boolean,
): Promise<{ retenus: ScrutinARattacher[]; ignores: number }> {
  if (sections.length === 0) return { retenus: [], ignores: 0 };
  const dates = sections.map((s) => s.date).sort();
  const debut = dates[0]!;
  const fin = dates[dates.length - 1]!;

  const lignes = await prisma.$queryRaw<
    { id: string; date: Date; titre: string | null; dossier_id: string | null; deja: boolean }[]
  >`
    SELECT s.id, s.date, s.titre, s.dossier_id,
           EXISTS (SELECT 1 FROM intervention_scrutin isc WHERE isc.scrutin_id = s.id) AS deja
    FROM scrutins s
    WHERE s.chambre = 'senat'
      AND s.date::date BETWEEN ${debut}::date AND ${fin}::date
    ORDER BY s.date, s.numero
  `;

  const retenus: ScrutinARattacher[] = [];
  let ignores = 0;
  for (const l of lignes) {
    if (l.deja && !refaireTout) {
      ignores++;
      continue;
    }
    retenus.push({
      id: l.id,
      // La date de séance sert de clé de rapprochement : on la prend telle que
      // le compte rendu l'écrit, sans passer par un fuseau.
      date: l.date.toISOString().slice(0, 10),
      titre: l.titre ?? '',
      dossierId: l.dossier_id,
    });
  }
  return { retenus, ignores };
}

/** Résout les ancres en interventions et écrit les liens. Rend le nombre de lignes écrites. */
async function ecrireEnBase(
  liens: LienSenat[],
): Promise<{ ecrits: number; scrutinsServis: Set<string> }> {
  const LOT = 2000;
  let ecrits = 0;
  const scrutinsServis = new Set<string>();
  for (let i = 0; i < liens.length; i += LOT) {
    const lot = liens.slice(i, i + LOT);
    // `servis` se lit sur les candidats et non sur les insertions : un lien
    // déjà présent ne s'insère pas, mais le scrutin a bien son débat.
    const lignes = await prisma.$queryRaw<{ scrutin_id: string; ecrits: bigint }[]>`
      WITH candidats AS (
        SELECT i.id AS intervention_id, v.scrutin_id, v.via
        FROM unnest(
          ${lot.map((l) => l.date)}::text[],
          ${lot.map((l) => l.ancre)}::text[],
          ${lot.map((l) => l.scrutinId)}::text[],
          ${lot.map((l) => l.via)}::text[]
        ) AS v(date, ancre, scrutin_id, via)
        JOIN interventions i ON ${RAPPROCHEMENT}
      ),
      inseres AS (
        INSERT INTO intervention_scrutin (intervention_id, scrutin_id, via)
        SELECT DISTINCT ON (intervention_id, scrutin_id) intervention_id, scrutin_id, via
        FROM candidats
        ORDER BY intervention_id, scrutin_id, via
        ON CONFLICT (intervention_id, scrutin_id) DO NOTHING
        RETURNING scrutin_id
      )
      SELECT c.scrutin_id,
             (SELECT COUNT(*) FROM inseres i WHERE i.scrutin_id = c.scrutin_id)::bigint AS ecrits
      FROM (SELECT DISTINCT scrutin_id FROM candidats) c
    `;
    for (const l of lignes) {
      scrutinsServis.add(l.scrutin_id);
      ecrits += Number(l.ecrits);
    }
  }
  return { ecrits, scrutinsServis };
}

/**
 * Écrit les liens dans un fichier, ancres résolues en interventions.
 *
 * C'est le format de la contre-épreuve : on charge le fichier dans une table
 * temporaire en production et on compte ce que la nouvelle règle changerait,
 * avant d'écrire quoi que ce soit.
 */
async function ecrireFichier(
  liens: LienSenat[],
  chemin: string,
): Promise<{ ecrits: number; scrutinsServis: Set<string> }> {
  const flux = fs.createWriteStream(chemin);
  const LOT = 2000;
  let ecrits = 0;
  const scrutinsServis = new Set<string>();
  for (let i = 0; i < liens.length; i += LOT) {
    const lot = liens.slice(i, i + LOT);
    const lignes = await prisma.$queryRaw<{ intervention_id: string; scrutin_id: string; via: string }[]>`
      SELECT DISTINCT i.id AS intervention_id, v.scrutin_id, v.via
      FROM unnest(
        ${lot.map((l) => l.date)}::text[],
        ${lot.map((l) => l.ancre)}::text[],
        ${lot.map((l) => l.scrutinId)}::text[],
        ${lot.map((l) => l.via)}::text[]
      ) AS v(date, ancre, scrutin_id, via)
      JOIN interventions i ON ${RAPPROCHEMENT}
    `;
    for (const l of lignes) {
      flux.write(`${l.intervention_id}\t${l.scrutin_id}\t${l.via}\n`);
      scrutinsServis.add(l.scrutin_id);
      ecrits++;
    }
  }
  flux.end();
  await new Promise<void>((resoudre) => flux.on('finish', () => resoudre()));
  return { ecrits, scrutinsServis };
}

/**
 * Prédicat de rapprochement, sur la date DE SÉANCE et l'ancre du compte rendu.
 *
 * Identique à celui de la segmentation : la date est reconstruite depuis
 * `seance_id` plutôt que lue dans `date`, cette colonne ayant longtemps porté
 * un décalage d'un jour (minuit local enregistré en UTC).
 */
const RAPPROCHEMENT = Prisma.raw(`
  i.chambre = 'senat'
  AND i.seance_id ~ '^d[0-9]{8}$'
  AND to_date(substring(i.seance_id from 2), 'YYYYMMDD') = v.date::date
  AND substring(i.source_url from '#par_([0-9]+)$') = v.ancre
`);

export default linkDebatsScrutinsSenat;
