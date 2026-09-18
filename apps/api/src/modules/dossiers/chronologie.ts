// =============================================================================
// La chronologie d'un dossier : où il a été discuté, et ce qui s'y est décidé
// =============================================================================
//
// CE QUI MANQUAIT. La page d'un dossier montrait ses amendements et ses
// scrutins — le résultat, jamais le parcours. On ne pouvait pas savoir quelle
// commission l'avait examiné, quand il était passé en séance, ni combien de
// fois : il fallait le deviner à partir des dates de scrutins.
//
// TROIS SOURCES, PARCE QU'AUCUNE NE SUFFIT :
//
//   - les prises de parole qui nomment le texte, qui donnent les séances où il
//     a été discuté et le poids de chaque discussion ;
//   - les avis rendus sur ses amendements, qui donnent les réunions de
//     commission — c'est aujourd'hui le seul chemin vers elles, les prises de
//     commission ne portant aucun texte ;
//   - les scrutins, qui donnent les séances où il a été mis aux voix, y compris
//     celles dont aucune prise de parole ne nomme le texte.
//
// Une même séance apparaît dans plusieurs de ces sources : on la rassemble sur
// son identifiant, et la date vient de la source la plus précise disponible —
// les prises de parole portent l'heure d'ouverture, les scrutins sont à minuit.
// =============================================================================

import { PrismaClient } from '@prisma/client';

/** Un vote, tel que la chronologie l'annonce sous son étape. */
export interface VoteDeChronologie {
  id: string;
  numero: number;
  titre: string;
  date: Date;
  sort: string;
  chambre: string;
  session: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
}

export interface EtapeDeChronologie {
  /** Identifiant de séance ou de réunion : sert de clé de rendu et d'URL. */
  uid: string;
  type: 'seance' | 'commission';
  date: Date;
  chambre: string | null;
  commission: { slug: string; nom: string } | null;
  /** Prises de parole qui nomment ce texte, quand on le sait. */
  nbPrises: number | null;
  /** Avis rendus sur ses amendements. */
  nbAvis: number | null;
  scrutins: VoteDeChronologie[];
}

const VOTE_SELECT = {
  id: true,
  numero: true,
  titre: true,
  date: true,
  sort: true,
  chambre: true,
  session: true,
  nombrePour: true,
  nombreContre: true,
  nombreAbstention: true,
  seanceRef: true,
} as const;

export async function chronologieDuDossier(
  prisma: PrismaClient,
  dossierId: string,
): Promise<EtapeDeChronologie[]> {
  const [prisesDeSeance, prisesDeCommission, avis, scrutins] = await Promise.all([
    prisma.intervention.groupBy({
      by: ['seanceId'],
      where: { dossierId, seanceId: { not: null } },
      _count: { _all: true },
      _min: { date: true },
    }),
    prisma.intervention.groupBy({
      by: ['reunionId'],
      where: { dossierId, reunionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.avisCommission.groupBy({
      by: ['reunionId'],
      where: { amendement: { dossierId } },
      _count: { _all: true },
    }),
    prisma.scrutin.findMany({
      where: { dossierId },
      select: VOTE_SELECT,
      orderBy: { numero: 'asc' },
    }),
  ]);

  const etapes = new Map<string, EtapeDeChronologie>();
  const poser = (uid: string, type: 'seance' | 'commission', date: Date): EtapeDeChronologie => {
    const deja = etapes.get(uid);
    if (deja) {
      // La source la plus précise gagne : une prise de parole porte l'heure
      // d'ouverture de la séance, un scrutin est daté à minuit.
      if (date > deja.date) deja.date = date;
      return deja;
    }
    const etape: EtapeDeChronologie = {
      uid,
      type,
      date,
      chambre: null,
      commission: null,
      nbPrises: null,
      nbAvis: null,
      scrutins: [],
    };
    etapes.set(uid, etape);
    return etape;
  };

  for (const ligne of prisesDeSeance) {
    if (!ligne.seanceId || !ligne._min.date) continue;
    poser(ligne.seanceId, 'seance', ligne._min.date).nbPrises = ligne._count._all;
  }

  for (const scrutin of scrutins) {
    if (!scrutin.seanceRef) continue;
    const etape = poser(scrutin.seanceRef, 'seance', scrutin.date);
    etape.chambre = scrutin.chambre;
    const { seanceRef: _ignore, ...vote } = scrutin;
    etape.scrutins.push(vote);
  }

  // Les réunions de commission sont identifiées par leur clé primaire dans les
  // deux sources ; il faut leur uid et leur date pour en faire une étape.
  const reunionIds = [
    ...new Set(
      [
        ...prisesDeCommission.map((l) => l.reunionId),
        ...avis.map((l) => l.reunionId),
      ].filter((id): id is string => id !== null),
    ),
  ];
  const reunions = reunionIds.length > 0
    ? await prisma.reunion.findMany({
        where: { id: { in: reunionIds } },
        select: {
          id: true,
          uid: true,
          dateDebut: true,
          commission: { select: { slug: true, nom: true, chambre: true } },
        },
      })
    : [];
  const reunionParId = new Map(reunions.map((r) => [r.id, r]));

  const marquerReunion = (reunionId: string | null, champ: 'nbPrises' | 'nbAvis', n: number) => {
    if (!reunionId) return;
    const reunion = reunionParId.get(reunionId);
    if (!reunion) return;
    const etape = poser(reunion.uid, 'commission', reunion.dateDebut);
    etape.chambre = reunion.commission?.chambre ?? etape.chambre;
    etape.commission = reunion.commission
      ? { slug: reunion.commission.slug, nom: reunion.commission.nom }
      : null;
    etape[champ] = n;
  };

  for (const ligne of prisesDeCommission) {
    marquerReunion(ligne.reunionId, 'nbPrises', ligne._count._all);
  }
  for (const ligne of avis) {
    marquerReunion(ligne.reunionId, 'nbAvis', ligne._count._all);
  }

  // La chambre d'une séance qu'aucun scrutin n'a nommée se lit sur la réunion
  // quand elle existe ; sinon la page de la séance la dira elle-même.
  const seancesSansChambre = [...etapes.values()].filter(
    (e) => e.type === 'seance' && e.chambre === null,
  );
  if (seancesSansChambre.length > 0) {
    const connues = await prisma.reunion.findMany({
      where: { uid: { in: seancesSansChambre.map((e) => e.uid) } },
      select: { uid: true, commission: { select: { chambre: true } } },
    });
    const chambreParUid = new Map(connues.map((r) => [r.uid, r.commission?.chambre ?? null]));
    for (const etape of seancesSansChambre) {
      etape.chambre = chambreParUid.get(etape.uid) ?? null;
    }
  }

  return [...etapes.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
