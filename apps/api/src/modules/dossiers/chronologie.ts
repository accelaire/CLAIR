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
import { jourDeSeanceSenat } from '../../utils/interventions';

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

/** Le texte discuté à une étape, quand la chronologie en couvre plusieurs. */
export interface TexteDEtape {
  uid: string;
  titre: string;
}

export interface EtapeDeChronologie {
  /** Identifiant de séance ou de réunion : sert de clé de rendu et d'URL. */
  uid: string;
  /**
   * Les textes de ce parcours examinés à cette étape.
   *
   * Vide sur la page d'un dossier, où tout porte sur le même texte ; renseigné
   * sur celle d'un sujet, qui en rassemble plusieurs — jusqu'aux deux versions
   * d'un même texte, à l'Assemblée et au Sénat.
   */
  textes: TexteDEtape[];
  type: 'seance' | 'commission';
  date: Date;
  chambre: string | null;
  commission: { slug: string; nom: string } | null;
  /** Prises de parole qui nomment ce texte, quand on le sait. */
  nbPrises: number | null;
  /** Avis rendus sur ses amendements. */
  nbAvis: number | null;
  /**
   * Vrai quand `/reunions/<uid>` a quelque chose à montrer.
   *
   * Un scrutin nomme toujours sa séance, mais nous ne détenons pas toutes les
   * séances qu'il nomme : 3 524 scrutins de l'Assemblée — 3 497 sur la seule
   * 15e législature — désignent une séance dont nous n'avons ni la réunion ni
   * le compte rendu. Lier ces étapes sans le dire envoyait le lecteur sur un
   * 404. La page de la séance existe si une réunion porte cet uid, ou si des
   * prises de parole s'y rattachent : c'est exactement ce que l'API résout.
   */
  consultable: boolean;
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

/** Le parcours d'un seul texte. */
export async function chronologieDuDossier(
  prisma: PrismaClient,
  dossierId: string,
): Promise<EtapeDeChronologie[]> {
  return chronologieDesDossiers(prisma, [{ id: dossierId, uid: '', titre: '' }], false);
}

/**
 * Le parcours de plusieurs textes à la fois : celui d'un sujet.
 *
 * Un sujet rassemble le texte de l'Assemblée et celui du Sénat, parfois
 * plusieurs lectures. Leurs étapes s'entrelacent dans le temps, et c'est
 * précisément ce qu'on veut montrer — d'où une seule chronologie et non une par
 * dossier, chaque étape nommant le texte qu'elle examine.
 */
export async function chronologieDesDossiers(
  prisma: PrismaClient,
  dossiers: Array<{ id: string; uid: string; titre: string }>,
  nommerLesTextes = true,
): Promise<EtapeDeChronologie[]> {
  if (dossiers.length === 0) return [];
  const ids = dossiers.map((d) => d.id);
  const texteParId = new Map(dossiers.map((d) => [d.id, { uid: d.uid, titre: d.titre }]));

  const [prisesDeSeance, prisesDeCommission, avis, scrutins] = await Promise.all([
    prisma.intervention.groupBy({
      // La chambre est groupée avec la séance parce qu'elle sert ensuite à
      // départager les journées : sans elle, une séance de l'Assemblée et une
      // du Sénat tenues le même jour se confondaient.
      by: ['seanceId', 'dossierId', 'chambre'],
      where: { dossierId: { in: ids }, seanceId: { not: null } },
      _count: { _all: true },
      _min: { date: true },
    }),
    prisma.intervention.groupBy({
      by: ['reunionId', 'dossierId'],
      where: { dossierId: { in: ids }, reunionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.avisCommission.groupBy({
      by: ['reunionId'],
      where: { amendement: { dossierId: { in: ids } } },
      _count: { _all: true },
    }),
    prisma.scrutin.findMany({
      where: { dossierId: { in: ids } },
      select: { ...VOTE_SELECT, dossierId: true },
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
      textes: [],
      type,
      date,
      chambre: null,
      commission: null,
      nbPrises: null,
      nbAvis: null,
      consultable: false,
      scrutins: [],
    };
    etapes.set(uid, etape);
    return etape;
  };

  /** Nomme le texte examiné à cette étape, sans doublon. */
  const noterLeTexte = (etape: EtapeDeChronologie, dossierId: string | null) => {
    if (!nommerLesTextes || !dossierId) return;
    const texte = texteParId.get(dossierId);
    if (!texte || etape.textes.some((t) => t.uid === texte.uid)) return;
    etape.textes.push(texte);
  };

  for (const ligne of prisesDeSeance) {
    if (!ligne.seanceId || !ligne._min.date) continue;
    const etape = poser(ligne.seanceId, 'seance', ligne._min.date);
    etape.chambre = etape.chambre ?? ligne.chambre;
    etape.nbPrises = (etape.nbPrises ?? 0) + ligne._count._all;
    noterLeTexte(etape, ligne.dossierId);
  }

  for (const scrutin of scrutins) {
    // Le Sénat ne nomme la séance sur aucun de ses scrutins : sa journée est le
    // seul rattachement, et c'est aussi l'identifiant sous lequel ses prises de
    // parole sont rangées. Sans ce repli, aucun vote du Sénat n'apparaissait
    // dans le parcours — celui d'un sujet ne montrait que l'Assemblée.
    const seance = scrutin.seanceRef
      ?? (scrutin.chambre === 'senat' ? jourDeSeanceSenat(scrutin.date) : null);
    if (!seance) continue;
    const etape = poser(seance, 'seance', scrutin.date);
    etape.chambre = scrutin.chambre;
    const { seanceRef: _ignore, dossierId, ...vote } = scrutin;
    etape.scrutins.push(vote);
    noterLeTexte(etape, dossierId);
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

  const marquerReunion = (
    reunionId: string | null,
    champ: 'nbPrises' | 'nbAvis',
    n: number,
    dossierId: string | null = null,
  ) => {
    if (!reunionId) return;
    const reunion = reunionParId.get(reunionId);
    if (!reunion) return;
    const etape = poser(reunion.uid, 'commission', reunion.dateDebut);
    etape.chambre = reunion.commission?.chambre ?? etape.chambre;
    etape.commission = reunion.commission
      ? { slug: reunion.commission.slug, nom: reunion.commission.nom }
      : null;
    etape[champ] = (etape[champ] ?? 0) + n;
    noterLeTexte(etape, dossierId);
  };

  for (const ligne of prisesDeCommission) {
    marquerReunion(ligne.reunionId, 'nbPrises', ligne._count._all, ligne.dossierId);
  }
  for (const ligne of avis) {
    marquerReunion(ligne.reunionId, 'nbAvis', ligne._count._all);
  }

  // Une étape de commission vient d'une ligne `reunions` : sa page existe. Une
  // étape de séance portant des prises de parole aussi, par le repli que
  // `/agenda/:uid` applique quand aucune réunion ne porte la référence.
  for (const etape of etapes.values()) {
    if (etape.type === 'commission' || (etape.nbPrises ?? 0) > 0) etape.consultable = true;
  }

  const seances = [...etapes.values()].filter((e) => e.type === 'seance');
  if (seances.length > 0) {
    const connues = await prisma.reunion.findMany({
      where: { uid: { in: seances.map((e) => e.uid) } },
      select: { uid: true, commission: { select: { chambre: true } } },
    });
    const chambreParUid = new Map(connues.map((r) => [r.uid, r.commission?.chambre ?? null]));
    for (const etape of seances) {
      if (chambreParUid.has(etape.uid)) etape.consultable = true;
      // La chambre d'une séance qu'aucun scrutin n'a nommée se lit sur la
      // réunion quand elle existe ; sinon la page de la séance la dira.
      if (etape.chambre === null) etape.chambre = chambreParUid.get(etape.uid) ?? null;
    }

    // Reste les séances qu'un scrutin nomme seul. Leur compte rendu peut
    // exister sans qu'aucune de ses prises ne cite nos textes : on refait donc
    // le test de l'API, sur la référence de séance et rien d'autre.
    const aVerifier = seances.filter((e) => !e.consultable);
    if (aVerifier.length > 0) {
      // `groupBy` et non `findMany({ distinct })` : sans l'option
      // `nativeDistinct`, Prisma 5 dédoublonne en mémoire après avoir rapatrié
      // toutes les lignes — jusqu'à 20 000 pour un seul dossier.
      const avecDebat = await prisma.intervention.groupBy({
        by: ['seanceId'],
        where: { seanceId: { in: aVerifier.map((e) => e.uid) } },
      });
      const attestees = new Set(avecDebat.map((l) => l.seanceId));
      for (const etape of aVerifier) {
        if (attestees.has(etape.uid)) etape.consultable = true;
      }
    }
  }

  return fusionnerLesJourneesSansReference(
    [...etapes.values()].sort((a, b) => a.date.getTime() - b.date.getTime()),
    await seancesNommeesParLeurCompteRendu(prisma, [...etapes.values()]),
  );
}

/**
 * Les séances qui n'ont d'autre nom que leur compte rendu.
 *
 * 1 233 comptes rendus de l'Assemblée ne déclarent aucune référence de séance :
 * leurs prises de parole sont rangées sous l'identifiant du compte rendu, quand
 * les scrutins du même jour nomment une séance que rien ne relie à celui-là. Le
 * test est direct — c'est exactement le cas où les deux colonnes coïncident.
 */
async function seancesNommeesParLeurCompteRendu(
  prisma: PrismaClient,
  etapes: EtapeDeChronologie[],
): Promise<Set<string>> {
  const uids = etapes.filter((e) => e.type === 'seance').map((e) => e.uid);
  if (uids.length === 0) return new Set();
  // `groupBy` pour la même raison que plus haut : `distinct` rapatriait toutes
  // les prises de chaque séance — jusqu'à 1 614 — pour n'en lire qu'une.
  const lignes = await prisma.intervention.groupBy({
    by: ['seanceId', 'seanceUid'],
    where: { seanceId: { in: uids } },
  });
  return new Set(
    lignes
      .filter((l) => l.seanceId !== null && l.seanceId === l.seanceUid)
      .map((l) => l.seanceId as string),
  );
}

/**
 * Rassemble, jour par jour, ce qu'on ne sait pas attribuer séance par séance.
 *
 * Sans cela, une journée de la 15e législature apparaissait DEUX FOIS dans le
 * parcours : une entrée pour le débat, sous l'identifiant du compte rendu, et
 * une autre pour les votes, sous la référence de séance des scrutins. Le
 * lecteur y voyait deux séances là où il n'y en avait qu'une.
 *
 * Seules les entrées de VOTE SANS DÉBAT rejoignent le compte rendu du jour :
 * ce sont elles que rien ne relie à leur débat. Deux comptes rendus d'une même
 * journée — le matin et l'après-midi — gardent chacun leur entrée et leur
 * page ; les fondre en une seule rendait l'une des deux inaccessible depuis le
 * parcours. Quand la journée en compte plusieurs, les votes vont au plus long
 * débat : la source ne dit pas à laquelle des séances ils appartiennent.
 */
export function fusionnerLesJourneesSansReference(
  etapes: EtapeDeChronologie[],
  sansReference: Set<string>,
): EtapeDeChronologie[] {
  if (sansReference.size === 0) return etapes;

  // La clé porte la chambre, et pas seulement la date. Une chronologie de sujet
  // couvre le texte de l'Assemblée ET celui du Sénat : sur une navette, les
  // deux chambres siègent le même jour, et une clé qui ne retient que la date
  // repliait la séance de l'une sur celle de l'autre — un seul uid, une seule
  // chambre, et les scrutins des deux mélangés sous la même étape.
  const cleDe = (e: EtapeDeChronologie) =>
    `${e.date.toISOString().slice(0, 10)}|${e.chambre ?? '?'}`;

  const hotes = new Map<string, EtapeDeChronologie>();
  for (const etape of etapes) {
    if (etape.type !== 'seance' || !sansReference.has(etape.uid)) continue;
    const cle = cleDe(etape);
    const deja = hotes.get(cle);
    if (!deja || (etape.nbPrises ?? 0) > (deja.nbPrises ?? 0)) hotes.set(cle, etape);
  }
  if (hotes.size === 0) return etapes;

  const gardees: EtapeDeChronologie[] = [];
  for (const etape of etapes) {
    const hote = hotes.get(cleDe(etape));
    const voteSansDebat = etape.type === 'seance'
      && !sansReference.has(etape.uid)
      && (etape.nbPrises ?? 0) === 0;
    if (!hote || !voteSansDebat) {
      gardees.push(etape);
      continue;
    }
    hote.scrutins.push(...etape.scrutins);
    for (const texte of etape.textes) {
      if (!hote.textes.some((t) => t.uid === texte.uid)) hote.textes.push(texte);
    }
  }

  return gardees;
}
