// =============================================================================
// Ce qu'un parlementaire n'a pas fait en parlementaire
// =============================================================================
//
// Pendant une présidence d'assemblée ou un poste au Gouvernement, un élu ne
// vote pas, et ce qu'il dit en séance, il le dit au banc du Gouvernement. Le
// calcul des statistiques (`services/ingestion/src/workers/stats-calculator.ts`,
// EMPECHEMENTS et PRISE_DE_PAROLE_PARLEMENTAIRE) écarte déjà ces lignes ; les
// fragments ci-dessous appliquent les mêmes règles aux listes de la fiche.
// Fragments SQL pour `$queryRawUnsafe`, sans paramètre : les alias de table
// sont choisis par l'appelant, jamais par l'utilisateur.

/**
 * Vote « absent » d'un élu qui ne pouvait pas voter (ticket #129) : président
 * de séance ou de l'assemblée, membre du Gouvernement. La source publie ces
 * scrutins comme des absences : 9 714 des 10 110 lignes de vote de Yaël
 * Braun-Pivet, les 11 de Sébastien Lecornu. Seules les lignes `absent` sont
 * visées : un vrai vote émis pendant la même période reste un vote.
 *
 * Trois sources, comme EMPECHEMENTS : le statut publié sur la ligne de vote,
 * les présidences datées des deux chambres, les postes ministériels datés
 * (bornes incluses, au jour).
 */
export function voteAbsentEmpeche(v: string, s: string): string {
  return `(
    ${v}.position = 'absent'
    AND (
      ${v}.statut_votant IN ('president_seance', 'gouvernement', 'president_assemblee')
      OR EXISTS (
        SELECT 1 FROM presidences_chambre pc
        WHERE pc.parlementaire_id = ${v}.parlementaire_id
          AND pc.chambre = ${s}.chambre
          AND ${s}.date::date >= pc.date_debut
          AND (pc.date_fin IS NULL OR ${s}.date::date <= pc.date_fin)
      )
      OR ${pendantUnPosteMinisteriel(`${v}.parlementaire_id`, `${s}.date`)}
    )
  )`;
}

/**
 * La personne `personne` occupait un poste ministériel le jour `date`
 * (bornes incluses).
 */
export function pendantUnPosteMinisteriel(personne: string, date: string): string {
  return `EXISTS (
        SELECT 1 FROM postes_ministeriels pm
        JOIN membres_gouvernement mg ON mg.id = pm.membre_id
        WHERE mg.parlementaire_id = ${personne}
          AND ${date}::date >= pm.date_debut
          AND (pm.date_fin IS NULL OR ${date}::date <= pm.date_fin)
      )`;
}

/**
 * Prise de parole au banc du Gouvernement, sur une ligne `interventions`
 * d'alias `i` : réponse d'un ministre, ou toute prise de parole tenue pendant
 * un poste ministériel. Complément exact de PRISE_DE_PAROLE_PARLEMENTAIRE
 * (stats-calculator) : les deux comptes s'additionnent pour donner la liste
 * des interventions de la fiche.
 */
export function priseDeParoleAuGouvernement(i: string): string {
  return `(${i}.type = 'reponse_gouvernement' OR ${pendantUnPosteMinisteriel(`${i}.parlementaire_id`, `${i}.date`)})`;
}
