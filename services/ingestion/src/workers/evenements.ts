// =============================================================================
// Événements institutionnels — repères du calendrier politique (agenda)
//
// Contrairement à tout le reste de l'ingestion, il n'y a AUCUNE source open data
// pour ces repères : ni l'AN ni le Sénat ne publient leur calendrier politique
// sous forme exploitable (le calendrier de session est un PDF, les décrets de
// convocation sont au JO). Le contenu est donc curé à la main ci-dessous et
// poussé par un upsert idempotent sur le `slug`.
//
// RÈGLE DE RIGUEUR — chaque entrée porte sa source, et `datePrecise: false`
// quand l'échéance est connue mais que sa date n'est pas encore fixée par
// décret. Dans ce cas `dateDebut` vaut le 1er du mois attendu et ne sert QU'AU
// TRI : l'UI affiche le mois, jamais le jour. On n'invente pas une date pour
// remplir une case.
//
// Entretien : cette liste se périme. À revoir à chaque rentrée parlementaire
// (octobre) et après chaque décret de convocation.
// =============================================================================

import type { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export type TypeEvenement =
  | 'election'
  | 'session'
  | 'suspension'
  | 'budget'
  | 'institution';

/** Une autorité citée. `url` absent quand la référence est un texte (Constitution…). */
export interface SourceEvenement {
  label: string;
  url?: string;
}

export interface EvenementSeed {
  slug: string;
  type: TypeEvenement;
  titre: string;
  description?: string;
  dateDebut: string; // 'YYYY-MM-DD'
  dateFin?: string; // période (suspension, session…) ; absent = ponctuel
  datePrecise?: boolean; // défaut true
  chambre?: 'assemblee' | 'senat'; // absent = les deux
  /** Au moins une. Plusieurs quand le repère vaut pour les deux chambres. */
  sources: SourceEvenement[];
  important?: boolean; // mis en avant dans « Prochaines échéances »
}

/**
 * Vérifié le 2026-08-15. Chaque date non triviale porte sa justification.
 */
export const EVENEMENTS: EvenementSeed[] = [
  // ---------------------------------------------------------------------------
  // Élections
  // ---------------------------------------------------------------------------
  {
    slug: 'senatoriales-2026',
    type: 'election',
    titre: 'Élections sénatoriales',
    description:
      'Renouvellement de la série 2 : 178 des 348 sièges, dans 64 circonscriptions. '
      + 'Le scrutin est indirect, réservé aux quelque 162 000 grands électeurs '
      + '(députés, conseillers régionaux et départementaux, délégués des conseils municipaux).',
    dateDebut: '2026-09-27',
    chambre: 'senat',
    sources: [
      { label: 'Sénat — Sénatoriales 2026', url: 'https://senatoriales2026.senat.fr/' },
      { label: 'Ministère de l’Intérieur', url: 'https://www.interieur.gouv.fr/actualites/actualites-du-ministere/elections-senatoriales-27-septembre-2026' },
    ],
    important: true,
  },
  {
    slug: 'presidentielle-2027',
    type: 'election',
    titre: 'Élection présidentielle',
    description:
      'Date non encore fixée par décret. Le 1er tour est attendu les 11 ou 18 avril 2027, '
      + 'le 2nd tour les 25 avril ou 2 mai. Le décret de convocation paraît au moins dix '
      + 'semaines avant le scrutin.',
    dateDebut: '2027-04-01',
    datePrecise: false,
    sources: [{ label: 'Service-Public.fr' }],
    important: true,
  },
  {
    slug: 'departementales-regionales-2028',
    type: 'election',
    titre: 'Élections départementales et régionales',
    description:
      'Reportées d’un an par la loi (initialement mars 2027) pour éviter la proximité avec '
      + 'la présidentielle et les législatives. Attendues en mars 2028, dates fixées par '
      + 'décret au moins six semaines avant.',
    dateDebut: '2028-03-01',
    datePrecise: false,
    sources: [{ label: 'Service-Public.fr' }],
  },
  {
    slug: 'legislatives-2029',
    type: 'election',
    titre: 'Élections législatives',
    description:
      'Renouvellement des 577 sièges de l’Assemblée nationale. Contrairement à une idée '
      + 'répandue, il n’y a pas de législatives en 2027 : la dissolution de juin 2024 a ouvert '
      + 'la XVIIe législature en juillet 2024, dont le mandat de cinq ans court jusqu’en juin '
      + '2029. Le scrutin doit se tenir au plus tard les 17 et 24 juin 2029, sauf dissolution '
      + 'anticipée. Dates fixées par décret.',
    dateDebut: '2029-06-01',
    datePrecise: false,
    chambre: 'assemblee',
    sources: [{ label: 'Article L.O. 121 du code électoral' }],
    important: true,
  },
  {
    slug: 'senatoriales-2029',
    type: 'election',
    titre: 'Élections sénatoriales',
    description:
      'Renouvellement de la série 1 (170 sièges), six ans après le scrutin de septembre 2023. '
      + 'Date fixée par décret.',
    dateDebut: '2029-09-01',
    datePrecise: false,
    chambre: 'senat',
    sources: [{ label: 'Code électoral — durée du mandat sénatorial' }],
  },

  // ---------------------------------------------------------------------------
  // Rythme de la session
  // ---------------------------------------------------------------------------
  {
    slug: 'suspension-estivale-2026',
    type: 'suspension',
    // Le titre dit « en séance publique » et pas « des travaux » tout court :
    // les commissions, elles, continuent de se réunir pendant la suspension
    // (auditions, commissions d'enquête). L'agenda en affiche pour septembre 2026.
    titre: 'Suspension de la séance publique',
    description:
      'La session extraordinaire s’est achevée le 21 juillet 2026, clôturée par décret publié '
      + 'le 22 juillet. La séance publique reprend à l’ouverture de la session ordinaire, le '
      + '1er octobre. Les commissions et les travaux de contrôle continuent pendant cette '
      + 'période : auditions et commissions d’enquête restent inscrites à l’agenda.',
    dateDebut: '2026-07-22',
    dateFin: '2026-09-30',
    // Sans chambre : la clôture de la session extraordinaire est prononcée par
    // décret pour le Parlement entier, et les deux chambres reprennent le même
    // jour puisque l'article 28 ouvre la session ordinaire au 1er octobre pour
    // les deux. Fenêtre vérifiée des DEUX côtés — le calendrier de séance de
    // chaque chambre est fixé par sa propre conférence des présidents, donc un
    // seul des deux sites ne suffisait pas à l'affirmer.
    sources: [
      { label: 'Assemblée nationale — suspension des travaux', url: 'https://www.assemblee-nationale.fr/dyn/actualites-accueil-hub/suspension-des-travaux-en-seance-publique3' },
      { label: 'Sénat — ordre du jour', url: 'https://www.senat.fr/ordre-du-jour/ordre-du-jour.html' },
    ],
  },
  {
    slug: 'ouverture-session-ordinaire-2026-2027',
    type: 'session',
    titre: 'Ouverture de la session ordinaire 2026-2027',
    description:
      'La session ordinaire s’ouvre de plein droit le premier jour ouvrable d’octobre et '
      + 'court jusqu’au dernier jour ouvrable de juin (article 28 de la Constitution). '
      + 'Elle ne peut excéder 120 jours de séance.',
    dateDebut: '2026-10-01',
    sources: [
      { label: 'Article 28 de la Constitution' },
      { label: 'Assemblée nationale — reprise des travaux', url: 'https://www.assemblee-nationale.fr/dyn/actualites-accueil-hub/suspension-des-travaux-en-seance-publique3' },
      { label: 'Sénat — calendrier de renouvellement des instances', url: 'https://www.senat.fr/ordre-du-jour/files/Calendrier_renouvellement_instances.pdf' },
    ],
    important: true,
  },
  {
    slug: 'cloture-session-ordinaire-2026-2027',
    type: 'session',
    titre: 'Clôture de la session ordinaire 2026-2027',
    description:
      'Fin de la session ordinaire (article 28 de la Constitution). Au-delà, le Parlement ne '
      + 'siège qu’en session extraordinaire, convoquée par décret.',
    dateDebut: '2027-06-30',
    sources: [{ label: 'Article 28 de la Constitution' }],
  },

  // ---------------------------------------------------------------------------
  // Renouvellement du Sénat et installation
  // ---------------------------------------------------------------------------
  {
    slug: 'prise-fonction-senateurs-2026',
    type: 'institution',
    titre: 'Entrée en fonction des sénateurs élus',
    description:
      'Les sénateurs élus le 27 septembre prennent leurs fonctions. Le mandat des sortants '
      + 'de la série 2, ouvert le 1er octobre 2020, s’achève la veille.',
    dateDebut: '2026-10-01',
    chambre: 'senat',
    sources: [{ label: 'Code électoral — article L.O. 276' }],
    important: true,
  },
  {
    slug: 'election-president-senat-2026',
    type: 'institution',
    titre: 'Élection du président du Sénat',
    description:
      'Après chaque renouvellement, le Sénat élit son président. L’ordre du jour publié '
      + 'inscrit à 15 heures l’installation du Bureau d’âge, l’ouverture de la session '
      + 'ordinaire, l’allocution du président d’âge, puis le scrutin secret à la tribune '
      + 'pour l’élection du président.',
    dateDebut: '2026-10-01',
    chambre: 'senat',
    sources: [
      { label: 'Sénat — calendrier de renouvellement des instances', url: 'https://www.senat.fr/ordre-du-jour/files/Calendrier_renouvellement_instances.pdf' },
      { label: 'Sénat — ordre du jour', url: 'https://www.senat.fr/ordre-du-jour/ordre-du-jour.html' },
    ],
    important: true,
  },
  {
    slug: 'constitution-groupes-senat-2026',
    type: 'institution',
    titre: 'Constitution des groupes politiques du Sénat',
    description:
      'Avant 16 heures, remise à la Présidence des listes des membres des groupes, des '
      + 'déclarations politiques et des déclarations comme groupe minoritaire ou d’opposition. '
      + 'C’est le moment où la composition politique du Sénat est officiellement arrêtée.',
    dateDebut: '2026-10-05',
    chambre: 'senat',
    sources: [{
      label: 'Sénat — calendrier de renouvellement des instances',
      url: 'https://www.senat.fr/ordre-du-jour/files/Calendrier_renouvellement_instances.pdf',
    }],
  },
  {
    slug: 'bureau-senat-2026',
    type: 'institution',
    titre: 'Élection du Bureau du Sénat',
    description:
      'À 14 h 30 en séance publique, désignation des vice-présidents, questeurs et secrétaires, '
      + 'puis proclamation de la constitution du Bureau définitif. La répartition numérique des '
      + 'sièges des commissions est arrêtée dans la foulée.',
    dateDebut: '2026-10-06',
    chambre: 'senat',
    sources: [{
      label: 'Sénat — calendrier de renouvellement des instances',
      url: 'https://www.senat.fr/ordre-du-jour/files/Calendrier_renouvellement_instances.pdf',
    }],
  },
  {
    slug: 'renouvellement-commissions-senat-2026',
    type: 'institution',
    titre: 'Constitution des bureaux des commissions du Sénat',
    // Date rendue PRÉCISE le 2026-08-15 : le Sénat a publié son calendrier de
    // renouvellement des instances. Sept commissions permanentes, pas huit —
    // la huitième entrée de notre table est la commission des affaires
    // européennes, constituée le même jour mais à 15 h 45.
    description:
      'À partir de 9 heures, constitution des bureaux des sept commissions permanentes, '
      + 'commission par commission : finances (9 h), lois (9 h 30), affaires économiques (10 h), '
      + 'aménagement du territoire (10 h 30), affaires sociales (11 h), culture (11 h 30), '
      + 'affaires étrangères (12 h). La commission des affaires européennes suit à 15 h 45. '
      + 'C’est là que se jouent les présidences et les rapporteurs généraux.',
    dateDebut: '2026-10-07',
    chambre: 'senat',
    sources: [{
      label: 'Sénat — calendrier de renouvellement des instances',
      url: 'https://www.senat.fr/ordre-du-jour/files/Calendrier_renouvellement_instances.pdf',
    }],
    important: true,
  },
  {
    slug: 'bureau-an-vice-presidents-2026',
    type: 'institution',
    titre: 'Élection des vice-présidents et questeurs de l’Assemblée',
    dateDebut: '2026-10-01',
    chambre: 'assemblee',
    sources: [{ label: 'Assemblée nationale — calendrier de la reprise des travaux', url: 'https://www.assemblee-nationale.fr/dyn/actualites-accueil-hub/suspension-des-travaux-en-seance-publique3' }],
  },
  {
    slug: 'bureau-an-secretaires-2026',
    type: 'institution',
    titre: 'Élection des secrétaires du Bureau de l’Assemblée',
    dateDebut: '2026-10-02',
    chambre: 'assemblee',
    sources: [{ label: 'Assemblée nationale — calendrier de la reprise des travaux', url: 'https://www.assemblee-nationale.fr/dyn/actualites-accueil-hub/suspension-des-travaux-en-seance-publique3' }],
  },

  // ---------------------------------------------------------------------------
  // Calendrier budgétaire
  // ---------------------------------------------------------------------------
  {
    slug: 'depot-plf-2027',
    type: 'budget',
    titre: 'Date limite de dépôt du projet de loi de finances pour 2027',
    description:
      'Le PLF doit être déposé sur le bureau de l’Assemblée nationale au plus tard le premier '
      + 'mardi d’octobre (article 39 de la LOLF), soit le 6 octobre 2026. L’Assemblée dispose '
      + 'ensuite de 40 jours pour se prononcer en première lecture, le Sénat de 20 jours, '
      + 'dans un délai global de 70 jours (article 47 de la Constitution).',
    dateDebut: '2026-10-06',
    chambre: 'assemblee',
    sources: [{ label: 'Article 39 de la LOLF' }],
    important: true,
  },
  {
    slug: 'depot-plfss-2027',
    type: 'budget',
    titre: 'Date limite de dépôt du projet de loi de financement de la sécurité sociale pour 2027',
    description:
      'Le PLFSS doit être déposé au plus tard le 15 octobre. Le Parlement dispose de 50 jours '
      + 'pour se prononcer (article 47-1 de la Constitution).',
    dateDebut: '2026-10-15',
    chambre: 'assemblee',
    sources: [{ label: 'Article L.O. 111-6 du code de la sécurité sociale' }],
  },
  {
    slug: 'date-limite-budget-2027',
    type: 'budget',
    titre: 'Date limite d’adoption du budget 2027',
    description:
      'Le budget doit être adopté avant la fin de l’année pour entrer en vigueur au 1er janvier. '
      + 'À défaut, le gouvernement peut recourir à une loi spéciale l’autorisant à percevoir '
      + 'les impôts existants.',
    dateDebut: '2026-12-31',
    sources: [{ label: 'Article 47 de la Constitution' }],
  },
];

export interface SyncEvenementsResult {
  created: number;
  updated: number;
  total: number;
}

/**
 * Pousse la liste curée en base. Idempotent : la clé est le `slug`, donc rejouer
 * ne crée rien et se contente de réaligner le contenu sur le code.
 *
 * Aucune suppression : un événement retiré de la liste reste en base (on ne veut
 * pas qu'une erreur d'édition efface un repère déjà servi). Le retrait se fait à
 * la main, sciemment.
 */
export async function syncEvenements(
  prisma: PrismaClient,
  evenements: EvenementSeed[] = EVENEMENTS,
): Promise<SyncEvenementsResult> {
  let created = 0;
  let updated = 0;

  for (const e of evenements) {
    const data = {
      type: e.type,
      titre: e.titre,
      description: e.description ?? null,
      dateDebut: new Date(`${e.dateDebut}T00:00:00.000Z`),
      dateFin: e.dateFin ? new Date(`${e.dateFin}T23:59:59.999Z`) : null,
      datePrecise: e.datePrecise ?? true,
      chambre: e.chambre ?? null,
      sources: e.sources as unknown as Prisma.InputJsonValue,
      important: e.important ?? false,
    };

    const existing = await prisma.evenementInstitutionnel.findUnique({
      where: { slug: e.slug },
      select: { id: true },
    });

    if (existing) {
      await prisma.evenementInstitutionnel.update({ where: { slug: e.slug }, data });
      updated++;
    } else {
      await prisma.evenementInstitutionnel.create({ data: { slug: e.slug, ...data } });
      created++;
    }
  }

  logger.info(
    { created, updated, total: evenements.length },
    'Événements institutionnels synchronisés',
  );

  return { created, updated, total: evenements.length };
}
