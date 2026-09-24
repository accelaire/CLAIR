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
  /**
   * Faux pour un mandat terminé : la fiche n'est alors plus « mise à jour
   * chaque jour », elle présente un bilan. Vrai par défaut.
   */
  enCours?: boolean;
}

const nombre = (n: number) => n.toLocaleString('fr-FR');

export function descriptionParlementaire({
  fullName,
  fonction,
  groupe,
  stats,
  enCours = true,
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

  const cloture = enCours ? 'Mis à jour chaque jour.' : 'Son bilan de mandat.';

  if (metriques.length === 0) {
    return enCours
      ? `${tete} Ses votes, ses interventions et ses amendements, mis à jour chaque jour.`
      : `${tete} Ses votes, ses interventions et ses amendements pendant son mandat.`;
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

export type Chambre = 'assemblee' | 'senat';

/**
 * Comment nommer la personne dans le titre et la description de sa fiche.
 *
 * Le titre disait « député » à tous les titulaires d'une fiche, en exercice ou
 * non : 591 des 1 168 fiches de `/deputes` sont celles d'anciens députés.
 * David Guiraud, maire de Roubaix depuis avril 2026, restait « député » dans
 * nos résultats Google, à côté d'un encadré Google qui le présente comme maire.
 * Une fiche qui contredit ce que le moteur sait de la personne a toutes les
 * chances d'être jugée périmée, et elle induit le lecteur en erreur.
 *
 * Pas de période (« 2022-2026 ») : nos mandats ne remontent qu'aussi loin que
 * l'historique ingéré, la 15e législature pour l'Assemblée et le milieu des
 * années 2000 pour le Sénat. Charles Pasqua, sénateur dès 1977, serait devenu
 * « ancien sénateur (2004-2011) ». Une période tronquée dans un titre est une
 * information fausse ; « ancien sénateur » est toujours vrai.
 */
export function fonctionParlementaire({
  chambre,
  sexe,
  actif,
}: {
  chambre: Chambre;
  sexe: string | null;
  /** `null` ou absent : traité comme en exercice, faute de savoir le contraire. */
  actif?: boolean | null;
}): { libelle: string; enCours: boolean } {
  const femme = sexe === 'F';
  const base =
    chambre === 'senat' ? (femme ? 'sénatrice' : 'sénateur') : femme ? 'députée' : 'député';

  if (actif !== false) return { libelle: base, enCours: true };
  return { libelle: `${femme ? 'ancienne' : 'ancien'} ${base}`, enCours: false };
}
