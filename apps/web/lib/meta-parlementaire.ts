/**
 * La meta description des fiches de parlementaires.
 *
 * Celle d'avant s'écrivait « Fiche de Louis Boyard, député — LFI-NFP — 94 -
 * Circonscription 3 (94) — Votes, présence, interventions et amendements sur
 * CLAIR.vote. » : le département y figurait deux fois (`circonscription.nom`
 * porte déjà son code), les six premiers mots ne disaient rien, et la phrase ne
 * promettait aucune information que le lecteur n'obtiendrait pas ailleurs.
 *
 * Ce que montre la Search Console : sur les requêtes de noms de parlementaires,
 * les pages sont en position 10 à 12, derrière Wikipédia, le site officiel de
 * la chambre et les profils sociaux, qui sont imprenables. La seule chose qui
 * distingue CLAIR de ces résultats, c'est le chiffre. La description mène donc
 * avec les chiffres, et eux seuls.
 *
 * Le budget de caractères est explicite : Google tronque autour de 155, et une
 * phrase coupée au milieu d'un nombre décrédibilise la donnée qu'on met en
 * avant. Les métriques sont ajoutées par ordre de valeur décroissante, tant
 * qu'elles tiennent.
 */

const BUDGET_DESCRIPTION = 155;

/**
 * Uniquement les champs que la description consomme. Les fiches de députés et
 * de sénateurs ne portent pas exactement les mêmes statistiques (la présence
 * solennelle n'existe qu'à l'Assemblée) : décrire ici la forme complète
 * obligerait les deux appelants à se ressembler sans raison.
 */
export interface StatsParlementaire {
  loyaute?: number | null;
  participation?: number | null;
  interventions?: number | null;
  amendements?: { proposes?: number | null } | null;
}

interface Params {
  fullName: string;
  /** « député », « députée », « sénateur », « sénatrice ». */
  fonction: string;
  /** Nom court du groupe, tel que l'API le résout déjà pour l'affichage. */
  groupe?: string | null;
  stats?: StatsParlementaire | null;
}

const nombre = (n: number) => n.toLocaleString('fr-FR');

export function descriptionParlementaire({
  fullName,
  fonction,
  groupe,
  stats,
}: Params): string {
  const tete = groupe
    ? `${fullName} (${groupe}), ${fonction}.`
    : `${fullName}, ${fonction}.`;

  // Les volumes d'abord : ce sont des faits bruts, que personne d'autre ne
  // publie, et qui ne portent aucun jugement. La loyauté ferme la liste parce
  // qu'elle s'interprète, et qu'une description tronquée juste après elle
  // laisserait un pourcentage sans son cadre.
  const metriques = [
    stats?.participation ? `${nombre(stats.participation)} votes` : null,
    stats?.interventions ? `${nombre(stats.interventions)} interventions` : null,
    stats?.amendements?.proposes
      ? `${nombre(stats.amendements.proposes)} amendements déposés`
      : null,
    stats?.loyaute ? `${stats.loyaute} % de loyauté au groupe` : null,
  ].filter((m): m is string => m !== null);

  const cloture = 'Mis à jour chaque jour.';

  if (metriques.length === 0) {
    return `${tete} Ses votes, ses interventions et ses amendements, mis à jour chaque jour.`;
  }

  const retenues: string[] = [];
  for (const metrique of metriques) {
    const essai = [...retenues, metrique];
    if (`${tete} ${essai.join(', ')}. ${cloture}`.length > BUDGET_DESCRIPTION) break;
    retenues.push(metrique);
  }

  // Un nom et un groupe assez longs peuvent à eux seuls manger le budget. Mieux
  // vaut alors une description qui dépasse d'une métrique qu'une description
  // qui n'annonce rien.
  if (retenues.length === 0) retenues.push(metriques[0]);

  return `${tete} ${retenues.join(', ')}. ${cloture}`;
}
