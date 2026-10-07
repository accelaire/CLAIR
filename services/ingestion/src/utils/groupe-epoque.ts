// =============================================================================
// Groupe d'époque d'un vote (SQL)
// =============================================================================
//
// Le groupe est un attribut du MANDAT, jamais de la personne. Les prompts IA
// agrégeaient les votes par `parlementaires.groupe_id`, le groupe d'AUJOURD'HUI :
// la loi de finances 2018 se lisait « Ensemble pour la République (EPR) et
// Renaissance ont voté pour », EPR n'existant qu'en 2024 ; les votes à l'AN des
// députés devenus sénateurs passaient sous leur groupe du Sénat ; et chaque
// changement de groupe courant (renouvellement du Sénat, pseudo-groupe « AUCUN »
// du 1er au 5 octobre 2026) changeait le hash et régénérait tout le corpus.
//
// Même règle que `votes_epoque` dans stats-calculator : à l'AN le mandat de la
// législature du scrutin, au Sénat le mandat en cours à sa date. Sans mandat
// d'époque doté d'un groupe (anciens sénateurs dont ODSEN ne publie pas le
// groupe, 2,5 % des votes du Sénat), la ligne est écartée plutôt que rangée
// sous le groupe actuel. `ORDER BY … LIMIT 1` départage les mandats qui se
// touchent à une borne (fin le jour où le suivant commence).
//
// Le générateur (ia-enrichment) ET le contrôle (checks/ia-quality) passent par
// ce fragment : un contrôle qui compterait les votes sous le groupe actuel
// signalerait comme inventé chaque groupe d'une législature passée que le
// résumé cite à raison (187 « groupes absents » le 7 octobre 2026).

import { Prisma } from '@prisma/client';

const ALIAS = /^[a-z][a-z0-9_]*$/;

/**
 * `JOIN` du groupe d'époque d'un vote. Attend les alias des tables `votes` et
 * `scrutins` de la requête englobante, expose `gp` (groupes_politiques).
 */
export function groupeDuVote(votes: string, scrutins: string): Prisma.Sql {
  if (!ALIAS.test(votes) || !ALIAS.test(scrutins)) {
    throw new Error(`Alias SQL invalide : ${votes}, ${scrutins}`);
  }
  const v = Prisma.raw(votes);
  const s = Prisma.raw(scrutins);
  return Prisma.sql`
  JOIN LATERAL (
    SELECT m.groupe_id
    FROM mandats_parlementaires m
    WHERE m.personne_id = ${v}.parlementaire_id
      AND m.chambre = ${s}.chambre
      AND m.groupe_id IS NOT NULL
      AND (
        (${s}.chambre = 'assemblee' AND ${s}.legislature IS NOT NULL AND m.legislature = ${s}.legislature)
        OR (${s}.chambre = 'senat' AND m.date_debut <= ${s}.date AND (m.date_fin IS NULL OR m.date_fin >= ${s}.date))
      )
    ORDER BY m.date_debut DESC, m.id
    LIMIT 1
  ) groupe_epoque ON TRUE
  JOIN groupes_politiques gp ON gp.id = groupe_epoque.groupe_id
`;
}
