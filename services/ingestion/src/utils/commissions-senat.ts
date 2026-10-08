// =============================================================================
// Commissions du Sénat — mandats que l'annuaire ne porte plus
// =============================================================================
//
// `senateurs.json` donne, pour chaque sénateur en exercice, ses commissions du
// moment, sans aucune date : sa commission permanente et, depuis le 8 octobre
// 2026, la commission des affaires européennes (41 membres), absente de
// l'annuaire auparavant. La synchro ouvrait un mandat de commission à chaque
// appartenance nouvelle et ne fermait JAMAIS l'ancienne.
// Mesure du 7 octobre 2026, au lendemain du renouvellement : 475 mandats
// ouverts dans les 7 commissions permanentes pour 347 appartenances réelles.
// 71 lignes appartenaient à des sénateurs sortis (dont la présidence de la
// commission des finances et 19 vice-présidences), 57 à des sénateurs en poste
// qui avaient changé de commission. Les pages affichaient 63 à 72 membres au
// lieu de 49 à 51.
//
// L'annuaire est la vérité du jour : un mandat ouvert sur l'une de ses
// commissions qu'il ne liste plus pour la personne est clos. Les organes qu'il
// ne publie pas (délégations, et les affaires européennes jusqu'au 7 octobre
// 2026) ne sont clos que pour les personnes qui ne sont plus sénateurs : 11
// sortants restaient aux affaires européennes, dont 4 vice-présidents. Le jour
// où l'annuaire a publié cette commission, ses 9 anciens membres encore
// sénateurs ont été clos à la date d'observation. La date de fin
// n'est pas publiée, on la reconstitue au plus près :
// - sénateur sorti : la fin de son dernier mandat de sénateur ;
// - changement de commission : la veille du début de la nouvelle appartenance,
//   quand elle est postérieure à l'ancienne ;
// - sinon : la date d'observation.

export interface MandatCommissionOuvert {
  id: string;
  parlementaireId: string;
  /** Matricule Sénat de la personne (`parlementaires.source_id`). */
  matricule: string | null;
  organeRef: string;
  dateDebut: Date;
}

export interface AppartenanceAnnuaire {
  matricule: string;
  organeRef: string;
}

export interface ClotureCommission {
  id: string;
  dateFin: Date;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

const cle = (matricule: string, organeRef: string) => `${matricule.toUpperCase()}|${organeRef}`;

/**
 * Mandats à clore, avec leur date de fin.
 *
 * @param ouverts mandats ouverts sur un organe du Sénat
 * @param annuaire appartenances publiées aujourd'hui (une par sénateur en exercice)
 * @param enExercice matricules de l'annuaire, y compris ceux sans commission
 * @param finSenat fin du dernier mandat de sénateur, pour les personnes sorties
 */
export function commissionsQuittees(
  ouverts: MandatCommissionOuvert[],
  annuaire: AppartenanceAnnuaire[],
  enExercice: Set<string>,
  finSenat: Map<string, Date>,
  maintenant: Date,
): ClotureCommission[] {
  const actuelles = new Set(annuaire.map((a) => cle(a.matricule, a.organeRef)));
  const codesAnnuaire = new Set(annuaire.map((a) => a.organeRef));
  const estEnExercice = (matricule: string | null) =>
    matricule !== null && enExercice.has(matricule.toUpperCase());

  // Début de l'appartenance actuelle de chaque personne, pour dater un changement.
  const debutActuel = new Map<string, Date>();
  for (const m of ouverts) {
    if (!m.matricule || !actuelles.has(cle(m.matricule, m.organeRef))) continue;
    const precedent = debutActuel.get(m.parlementaireId);
    if (!precedent || m.dateDebut > precedent) debutActuel.set(m.parlementaireId, m.dateDebut);
  }

  const clotures: ClotureCommission[] = [];
  for (const m of ouverts) {
    if (m.matricule && actuelles.has(cle(m.matricule, m.organeRef))) continue;
    // Organe absent de l'annuaire : on ne sait rien des appartenances des
    // sénateurs en exercice, on ne clôt que celles des personnes sorties.
    if (!codesAnnuaire.has(m.organeRef) && estEnExercice(m.matricule)) continue;

    let fin = maintenant;
    if (estEnExercice(m.matricule)) {
      const nouvelle = debutActuel.get(m.parlementaireId);
      if (nouvelle && nouvelle > m.dateDebut) fin = new Date(nouvelle.getTime() - JOUR_MS);
    } else {
      const finMandat = finSenat.get(m.parlementaireId);
      if (finMandat && finMandat < maintenant) fin = finMandat;
    }
    // Jamais avant le début : une fin antérieure rendrait la ligne incohérente.
    if (fin < m.dateDebut) fin = m.dateDebut;
    clotures.push({ id: m.id, dateFin: fin });
  }
  return clotures;
}
