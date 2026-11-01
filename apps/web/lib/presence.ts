// Présence d'un parlementaire, selon sa chambre (ticket #108).
//
// À l'Assemblée, chaque député vote lui-même : le taux de participation aux
// scrutins publics mesure sa présence. Au Sénat, un scrutin ordinaire se vote
// par groupe : un délégué dépose les bulletins de tous les membres, présents ou
// non. Plus de 200 sénateurs affichaient 100 % de « présence ». Seuls les
// scrutins solennels, où chacun vote en personne ou confie son vote à un
// collègue, disent qui était là : c'est la présence d'un sénateur. Le taux tous
// scrutins devient sa participation aux scrutins.

export type ChambreParlementaire = 'assemblee' | 'senat';

export interface StatsPresence {
  /** Null au Sénat sans aucun scrutin où il pouvait voter (président du Sénat). */
  presence: number | null;
  presenceSolennel?: number | null;
}

/** Explication courte, pour une infobulle ou une note sous un classement. */
export const PRESENCE_SENAT_EXPLICATION =
  'Au Sénat, un scrutin ordinaire se vote par groupe : un délégué dépose les bulletins de tous les membres, présents ou non. ' +
  'Seuls les scrutins solennels, où chacun vote en personne ou confie son vote à un collègue, mesurent la présence. ' +
  'Un vote confié à un collègue compte comme une absence. Le président du Sénat, le président de séance et les membres du gouvernement, qui ne votent pas, sont hors calcul.';

export const PRESENCE_SENAT_NON_MESURABLE =
  "Aucun scrutin solennel sur la période : la présence de ce sénateur n'est pas mesurable.";

/**
 * Valeur de présence à afficher ou à comparer : présence aux votes solennels pour
 * un sénateur (`null` sans scrutin solennel sur la période), taux de
 * participation aux scrutins pour un député.
 */
export function presenceDe(chambre: string | null | undefined, stats: StatsPresence | null | undefined): number | null {
  if (!stats) return null;
  if (chambre === 'senat') return stats.presenceSolennel ?? null;
  return stats.presence;
}

/** Libellé de la présence pour une chambre. */
export function libellePresence(chambre: string | null | undefined): string {
  return chambre === 'senat' ? 'Présence aux votes solennels' : 'Présence';
}
