/**
 * Repères du renouvellement sénatorial du 27 septembre 2026, fixés par décret de convocation
 * (repris de apps/web `lib/senatoriales.ts`). La source de vérité reste la ligne
 * `senatoriales-2026` des événements institutionnels, que l'API renvoie dans l'aperçu.
 */
export const SENATORIALES_2026 = {
  /** Dimanche du scrutin. */
  scrutin: "2026-09-27",
  /** Entrée en fonction des élus. */
  priseDeFonction: "2026-10-01",
  /** Série renouvelée : 178 sièges dans 64 circonscriptions. */
  serie: "2",
  href: "/senatoriales-2026",
} as const;

/** Effectif du Sénat fixé par l'article L.O. 274 du code électoral. */
export const SIEGES_SENAT = 348;

/**
 * Fenêtre du direct des résultats : des premiers résultats du dimanche, vers 11h30 heure de
 * Paris, au lundi matin (le dernier siège, 2nd tour de la Polynésie française, a été publié à
 * 1h20 : le direct s'arrête à 7h).
 */
export const DIRECT_RESULTATS = {
  debut: "2026-09-27T09:30:00Z",
  fin: "2026-09-28T05:00:00Z",
} as const;

/** Sommes-nous dans la fenêtre du direct des résultats ? */
export const resultatsEnDirect = (maintenant: Date = new Date()): boolean => {
  const t = maintenant.getTime();
  return t >= Date.parse(DIRECT_RESULTATS.debut) && t < Date.parse(DIRECT_RESULTATS.fin);
};

/** Minuit à Paris le jour du vote : avant, la page d'une circonscription reste celle des candidats. */
export const JOUR_DU_SCRUTIN = new Date("2026-09-27T00:00:00+02:00");

/**
 * Pastille de compte à rebours de la page des sénatoriales. Minuit à Paris, et non en UTC :
 * `new Date('2026-09-27')` tombait à 2h du matin et annonçait « Scrutin passé » le jour même.
 */
export const compteARebours = (maintenant: Date): string => {
  const scrutin = new Date("2026-09-27T00:00:00+02:00");
  const lendemain = new Date("2026-09-28T00:00:00+02:00");
  const priseDeFonction = new Date("2026-10-01T00:00:00+02:00");
  if (maintenant < scrutin) {
    const jours = Math.ceil((scrutin.getTime() - maintenant.getTime()) / (1000 * 60 * 60 * 24));
    return `J-${jours} avant le scrutin`;
  }
  if (maintenant < lendemain) return "Jour du scrutin";
  if (maintenant < priseDeFonction) return "Scrutin passé";
  return "Les nouveaux sénateurs sont entrés en fonction";
};
