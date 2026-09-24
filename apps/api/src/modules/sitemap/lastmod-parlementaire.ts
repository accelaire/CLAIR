// =============================================================================
// Date de dernière modification d'une fiche de parlementaire, pour le sitemap.
// =============================================================================
//
// Le sitemap n'en déclarait aucune : la seule date disponible, `updatedAt`, est
// reposée par la synchronisation nocturne sur chaque ligne qu'elle visite, qu'un
// contenu ait changé ou non. Les 925 parlementaires actifs se déclaraient donc
// modifiés tous les jours, et l'omission valait mieux qu'une date fausse.
//
// Mais l'omission a un prix, constaté le 2026-09-24 : Google affichait encore
// pour Louis Boyard le résumé du 22 août, un mois après, alors que la fiche avait
// été régénérée le 20 septembre. Sans date, rien ne lui signale qu'une page a
// changé, et il espace ses passages.
//
// La date retenue est celle d'un changement de contenu réel, la plus récente
// des deux :
//
// - l'arrivée du dernier scrutin de la chambre. Pour un parlementaire en
//   exercice, chaque nouveau scrutin modifie sa fiche même s'il n'a pas voté :
//   son taux de présence est calculé sur l'ensemble des scrutins de la chambre.
//   C'est `created_at` (l'ingestion) et non `date` (la séance) : la fiche change
//   quand le scrutin arrive chez nous, pas quand il a eu lieu.
// - la dernière génération de sa fiche IA, qui réécrit le texte de présentation.
//
// Pendant les vacances parlementaires, aucune des deux ne bouge, et la date non
// plus : c'est ce qui la rend crédible, là où `updatedAt` avançait chaque nuit.
//
// Le dernier vote de la personne elle-même serait plus fin, mais il faut pour
// l'obtenir parcourir la table des votes (3,9 millions de lignes, ~11 s et
// ~750 Mo lus sur la prod, mesuré le 2026-09-24) : hors de proportion pour un
// signal que le dernier scrutin de la chambre donne déjà.
// =============================================================================

export interface ParlementaireLastmodInput {
  chambre: string;
  iaGeneratedAt: Date | null;
}

/** Plus récente des dates connues, ou `null` si aucune ne l'est. */
export function lastmodParlementaire(
  parlementaire: ParlementaireLastmodInput,
  dernierScrutinParChambre: ReadonlyMap<string, Date>,
): Date | null {
  const candidates = [
    dernierScrutinParChambre.get(parlementaire.chambre) ?? null,
    parlementaire.iaGeneratedAt,
  ].filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));

  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}
