/**
 * Repères du renouvellement sénatorial du 27 septembre 2026.
 *
 * Ces dates dupliquent la ligne `senatoriales-2026` de `evenements_institutionnels`,
 * qui reste la source de vérité (la page /senatoriales-2026 les lit via l'API).
 * On les fige ici pour les affichages conditionnels dispersés — fiche de sénateur,
 * accroche de la page d'accueil — qui ne peuvent pas justifier un appel réseau
 * supplémentaire juste pour savoir s'il faut afficher une ligne.
 *
 * Elles sont fixées par décret de convocation : elles ne bougeront plus.
 */
export const SENATORIALES_2026 = {
  /** Dimanche du scrutin. */
  scrutin: '2026-09-27',
  /** Entrée en fonction des élus. Passé cette date, la série 2 désigne les entrants. */
  priseDeFonction: '2026-10-01',
  /** Série renouvelée : 178 sièges dans 64 circonscriptions. */
  serie: '2',
  href: '/senatoriales-2026',
} as const;

/**
 * Le renouvellement est-il encore à venir ?
 *
 * Sert de garde à tous les affichages « siège remis en jeu ». Le seuil est la
 * prise de fonction et non le scrutin : entre les deux, les sortants siègent
 * encore et l'information reste juste. Après, elle devient fausse — les
 * sénateurs de série 2 sont alors les nouveaux élus.
 *
 * Le jour courant est pris en UTC, et non en heure locale : ces blocs sont rendus
 * une première fois sur le serveur puis réhydratés dans le navigateur. Avec une
 * date locale, le 30 septembre entre 22 h et minuit UTC, un serveur en UTC et un
 * lecteur à Paris ne tomberaient pas d'accord sur le jour — donc pas sur ce qu'il
 * faut afficher, et React signalerait une divergence d'hydratation. Conséquence
 * assumée : le basculement se fait à 2 h du matin, heure de Paris.
 */
export function renouvellementAVenir(aujourdhui: Date = new Date()): boolean {
  return aujourdhui.toISOString().slice(0, 10) < SENATORIALES_2026.priseDeFonction;
}

/** Ce siège est-il remis en jeu ? */
export function siegeRenouvelable(
  parlementaire: { chambre?: string | null; serie?: string | null; actif?: boolean | null },
  aujourdhui: Date = new Date(),
): boolean {
  return (
    parlementaire.chambre === 'senat' &&
    parlementaire.serie === SENATORIALES_2026.serie &&
    parlementaire.actif === true &&
    renouvellementAVenir(aujourdhui)
  );
}
