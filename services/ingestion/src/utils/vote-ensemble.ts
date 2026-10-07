// =============================================================================
// Vote sur l'ensemble d'un texte (SQL)
// =============================================================================
//
// Les positions « sur l'ensemble du texte » des prompts IA agrègent les scrutins
// solennels et ceux dont le titre mentionne l'ensemble. Une loi de finances vote
// aussi chacune de ses PARTIES : « la première partie du projet de loi de
// finances pour 2025 », rejetée le 12 novembre 2024, la gauche votant pour sa
// version amendée et le bloc central contre. Le texte est ensuite passé au 49.3 :
// ce vote partiel était le seul vote « d'ensemble » du dossier, et le résumé
// annonçait « LFI a soutenu le texte, EPR l'a rejeté ».
//
// Mesure du 7 octobre 2026 : 44 scrutins (9 AN, 35 Sénat) portent sur une partie
// ordinale d'un texte, tous des lois de finances ou de financement de la
// sécurité sociale. « la sixième partie du code » (loi organique) n'est pas
// visée : l'ordinal s'arrête à quatre.
//
// Le générateur (ia-enrichment) et le contrôle (checks/ia-quality) passent par
// ce fragment, pour juger un résumé avec les votes que son prompt a reçus.

import { Prisma } from '@prisma/client';

/** Titre d'un vote sur une partie d'un texte (regex PostgreSQL, insensible à la casse). */
export const PARTIE_DE_TEXTE = String.raw`\m(premi[eè]re|deuxi[eè]me|seconde|troisi[eè]me|quatri[eè]me) partie\M`;

const ALIAS = /^[a-z][a-z0-9_]*$/;

/** Condition « vote sur l'ensemble du texte » sur l'alias de la table `scrutins`. */
export function voteSurLEnsemble(scrutins: string): Prisma.Sql {
  if (!ALIAS.test(scrutins)) throw new Error(`Alias SQL invalide : ${scrutins}`);
  const s = Prisma.raw(scrutins);
  // Une motion de censure ne porte pas sur l'ensemble d'un texte : seules ses
  // voix POUR existent, elles ont leur propre section dans le prompt.
  return Prisma.sql`((${s}.type_vote = 'solennel' OR ${s}.titre ILIKE '%ensemble%') AND ${s}.titre !~* ${PARTIE_DE_TEXTE} AND ${s}.titre !~* 'motion de censure')`;
}
