// =============================================================================
// Date de fin d'un mandat d'organe AN
// =============================================================================
//
// Partagée par les deux chemins qui écrivent les mandats d'organe AN depuis
// l'AMO10 : la synchro des mandats de commission (`sync.ts`, chaque nuit) et
// l'enrichissement des fiches. Appliquée d'un seul côté, l'autre rouvrait ce
// que le premier avait clos.

/**
 * Le bureau d'âge (président et secrétaires d'âge) ne siège que jusqu'à
 * l'élection du président, le jour même : l'AMO10 a publié celui du 18/07/2024
 * sans date de fin, et Jean-Pierre Gonzalez restait « Président d'âge » en
 * cours deux ans plus tard (celui de 2022 était clos le jour même). Une
 * fonction d'âge sans fin se clôt donc à sa date de début.
 */
export function dateFinMandatAN(m: { typeOrgane: string; qualite: string | null; dateDebut: string | null; dateFin: string | null }): string | null {
  if (m.dateFin) return m.dateFin;
  if (m.typeOrgane === 'BUREAU' && /\bd['’]âge\b/i.test(m.qualite ?? '') && m.dateDebut) return m.dateDebut;
  return null;
}
