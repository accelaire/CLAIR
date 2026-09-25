/**
 * Grands électeurs inscrits dans chaque circonscription de la série 2.
 *
 * Source : ministère de l'Intérieur, « Élections sénatoriales 2026 - Nombre
 * d'inscrits par bureau de vote », publié le 9 septembre 2026 sur data.gouv :
 * https://www.data.gouv.fr/datasets/elections-senatoriales-2026-nombre-dinscrits-par-bureau-de-vote/
 * (fichier `referentiel-des-bureaux-de-vote-sen2026csv.csv`, 107 circonscriptions
 * des deux séries ; seules les 64 de la série 2 sont reprises, `ZZ` → `997`).
 *
 * Figé ici plutôt qu'ingéré : le collège est arrêté avant le scrutin et ne bouge
 * plus. Le soir du vote, le chiffre qui fait foi est celui des inscrits publiés
 * avec les résultats ; celui-ci ne sert qu'avant leur publication.
 *
 * Total : 92257 grands électeurs.
 */
export const GRANDS_ELECTEURS: Record<string, number> = {
  '01': 1952,
  '02': 1746,
  '03': 970,
  '04': 565,
  '05': 449,
  '06': 2093,
  '07': 1023,
  '08': 964,
  '09': 628,
  '10': 1025,
  '11': 1196,
  '12': 899,
  '13': 3695,
  '14': 2125,
  '15': 534,
  '16': 1165,
  '17': 1856,
  '18': 882,
  '19': 761,
  '21': 1648,
  '22': 1759,
  '23': 484,
  '24': 1382,
  '25': 1658,
  '26': 1444,
  '27': 1919,
  '28': 1321,
  '29': 2348,
  '2A': 465,
  '2B': 616,
  '30': 1982,
  '31': 3325,
  '32': 792,
  '33': 3743,
  '34': 2729,
  '35': 2769,
  '36': 686,
  '67': 2843,
  '68': 2010,
  '69': 3817,
  '70': 965,
  '71': 1682,
  '72': 1578,
  '73': 1248,
  '74': 2112,
  '76': 3207,
  '79': 1150,
  '80': 1819,
  '81': 1153,
  '82': 758,
  '83': 2348,
  '84': 1318,
  '85': 1860,
  '86': 1202,
  '87': 986,
  '88': 1196,
  '89': 1115,
  '90': 381,
  '973': 577,
  '977': 21,
  '978': 25,
  '986': 22,
  '987': 733,
  '997': 533,
};
