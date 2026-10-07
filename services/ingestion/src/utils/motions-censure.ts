// =============================================================================
// Motions de censure — appariement par les auteurs (SQL)
// =============================================================================
//
// Une motion de censure se rattache par les `voteRefs` de son dossier. Les
// dossiers « Motion de censure » antérieurs à 2024, et quelques-uns depuis,
// n'en publient aucune : leur motion restait orpheline, ou, avant le garde-fou
// du 7 octobre 2026, le TF-IDF y empilait n'importe quelle motion (31 sur un
// seul dossier).
//
// Le titre du scrutin et celui du dossier nomment pourtant les mêmes auteurs :
// « la motion de censure … par Mme Mathilde Panot et 86 députés » et « Motion de
// censure … par Mme Mathilde Panot et 86 de ses collègues ». La clé retenue est
// le nom du premier signataire et le nombre de cosignataires, dans la même
// législature, et l'appariement n'est fait que s'il est unique des deux côtés.
// Au 7 octobre 2026, elle retrouve les 7 motions orphelines qui avaient un
// dossier sans références, sans aucune ambiguïté.

/** Clé « nom du premier signataire | nombre de cosignataires » d'un titre (expression SQL). */
export function cleMotion(colonneTitre: string): string {
  if (!/^[a-z_][a-z0-9_]*\.[a-z_]+$/.test(colonneTitre)) {
    throw new Error(`Colonne SQL invalide : ${colonneTitre}`);
  }
  return `(lower(regexp_replace(substring(${colonneTitre} from ' par (?:MM?\\.|Mmes?\\.?)? ?([^,]+?)(?:,| et )'), '^.* ', ''))`
    + ` || '|' || coalesce(substring(${colonneTitre} from ' et (\\d+) '), ''))`;
}

/** Le dossier d'alias `alias` est un dossier de motion qui ne publie aucune référence de vote. */
export function dossierMotionSansReferences(alias: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(alias)) throw new Error(`Alias SQL invalide : ${alias}`);
  return `(${alias}.titre ~* '^motion de censure'`
    + ` AND NOT EXISTS (SELECT 1 FROM jsonb_path_query(${alias}.source_data, 'strict $.**.voteRefs.voteRef')))`;
}
