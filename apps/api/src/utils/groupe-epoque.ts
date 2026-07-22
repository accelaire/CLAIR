// =============================================================================
// Groupe d'époque — résolution du groupe politique d'un parlementaire À LA DATE
// D'UN SCRUTIN, et non aujourd'hui.
// Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
// =============================================================================
//
// `parlementaires.groupe_id` porte le groupe COURANT de la personne. Tant que la
// base ne contenait qu'une législature, courant == d'époque, et joindre ce champ
// donnait la bonne réponse. Ce n'est plus vrai : un député réélu siège dans un
// autre groupe (ou le même sous un autre uid d'organe), si bien que 70 % des
// votes de la 16e législature étaient attribués au mauvais groupe.
//
// Le groupe est un attribut du MANDAT, pas de la personne. On le résout donc via
// `mandats_parlementaires`, en sélectionnant le mandat qui couvre le scrutin :
//   - Assemblée : le mandat de la MÊME LÉGISLATURE que le scrutin ;
//   - Sénat : le mandat dont l'intervalle contient la DATE du scrutin (le Sénat
//     n'a pas de législature ; il se renouvelle par moitié).
//
// Repli : si aucun mandat ne correspond (scrutin AN sans `legislature` — donnée
// legacy —, ou personne sans mandat), on retombe sur le groupe courant. La
// dégradation est donc gracieuse : jamais pire que le comportement précédent.

import type { PrismaClient, Prisma } from '@prisma/client';

/** Ce qu'il faut connaître d'un scrutin pour situer un mandat dans le temps. */
export interface ScrutinPeriode {
  chambre: string;
  legislature?: number | null;
  date: Date;
}

export interface GroupeEpoque {
  id: string;
  slug: string;
  nom: string;
  couleur: string | null;
}

/**
 * Filtre Prisma isolant le mandat qui couvre ce scrutin.
 *
 * Renvoie `null` quand la période n'est pas déterminable (scrutin AN sans
 * `legislature`) : l'appelant doit alors s'en tenir au groupe courant.
 */
export function mandatPeriodeWhere(
  scrutin: ScrutinPeriode
): Prisma.MandatParlementaireWhereInput | null {
  if (scrutin.chambre === 'senat') {
    return {
      chambre: 'senat',
      dateDebut: { lte: scrutin.date },
      OR: [{ dateFin: null }, { dateFin: { gte: scrutin.date } }],
    };
  }

  if (scrutin.legislature == null) return null;

  return { chambre: 'assemblee', legislature: scrutin.legislature };
}

/**
 * Filtre Prisma sur un `Parlementaire` : « a siégé dans ce groupe au moment de
 * ce scrutin ». À utiliser pour filtrer les votes par groupe, plutôt que
 * `parlementaire: { groupe: { slug } }` qui interroge le groupe courant.
 */
export function parlementaireDansGroupeAuScrutin(
  scrutin: ScrutinPeriode,
  groupeSlug: string
): Prisma.ParlementaireWhereInput {
  const periode = mandatPeriodeWhere(scrutin);

  if (!periode) {
    // Période indéterminable : on ne peut pas faire mieux que le groupe courant.
    return { groupe: { slug: groupeSlug } };
  }

  return {
    mandatsParlementaires: {
      some: { ...periode, groupe: { slug: groupeSlug } },
    },
  };
}

/**
 * Charge, pour un ensemble de parlementaires, le groupe qu'ils avaient au moment
 * du scrutin. Une seule requête, quel que soit le nombre de votants (pas de N+1).
 *
 * Les parlementaires absents de la Map n'ont pas de mandat sur la période :
 * l'appelant conserve alors le groupe courant.
 */
export async function chargerGroupesEpoque(
  prisma: PrismaClient,
  scrutin: ScrutinPeriode,
  parlementaireIds: string[]
): Promise<Map<string, GroupeEpoque>> {
  const periode = mandatPeriodeWhere(scrutin);
  if (!periode || parlementaireIds.length === 0) return new Map();

  const mandats = await prisma.mandatParlementaire.findMany({
    where: { ...periode, personneId: { in: parlementaireIds }, groupeId: { not: null } },
    select: {
      personneId: true,
      groupe: { select: { id: true, slug: true, nom: true, couleur: true } },
    },
  });

  const parPersonne = new Map<string, GroupeEpoque>();
  for (const mandat of mandats) {
    if (mandat.groupe) parPersonne.set(mandat.personneId, mandat.groupe);
  }
  return parPersonne;
}

/**
 * CTE `group_majority` : position majoritaire, pour chaque scrutin, du groupe où
 * le parlementaire siégeait À CE MOMENT-LÀ.
 *
 * Sert à qualifier un vote de dissident. La référence ne peut pas être un groupe
 * fixe : un député de la 16e comparé à la position de son groupe de la 17e serait
 * déclaré dissident à tort. On résout donc, scrutin par scrutin, son groupe
 * d'époque (`mm`), puis la majorité des membres de CE groupe à CE scrutin (`gm`).
 *
 * Les identifiants sont interpolés (et non passés en paramètre) pour ne pas
 * perturber la numérotation `$1..$n` des requêtes appelantes : ce sont des UUID
 * issus de notre propre base, jamais une saisie utilisateur libre.
 */
export function CTE_GROUP_MAJORITY_EPOQUE(
  parlementaireId: string,
  groupeCourantId: string
): string {
  assertUuid(parlementaireId);
  assertUuid(groupeCourantId);

  return `group_majority AS (
    SELECT
      gv.scrutin_id,
      gv.position as majority_position,
      ROW_NUMBER() OVER (PARTITION BY gv.scrutin_id ORDER BY COUNT(*) DESC) as rn
    FROM votes gv
    JOIN scrutins gs ON gs.id = gv.scrutin_id
    JOIN parlementaires gp ON gp.id = gv.parlementaire_id
    ${joinMandatEpoque('gv', 'gs', 'gm')}
    -- le vote du parlementaire étudié sur ce scrutin, et son groupe d'époque
    JOIN votes mv ON mv.scrutin_id = gv.scrutin_id AND mv.parlementaire_id = '${parlementaireId}'
    ${joinMandatEpoque('mv', 'gs', 'mm')}
    WHERE gv.position != 'absent'
      AND COALESCE(gm.groupe_id, gp.groupe_id) = COALESCE(mm.groupe_id, '${groupeCourantId}')
    GROUP BY gv.scrutin_id, gv.position
  )`;
}

/** Les UUID interpolés en SQL viennent de la base ; on le vérifie tout de même. */
function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Identifiant non conforme (UUID attendu): ${value}`);
  }
}

/**
 * Périmètre de scrutins d'un parlementaire : ceux des périodes où il siégeait.
 *
 * C'est le dénominateur juste pour toute statistique (présence, loyauté…). Le
 * prendre sur « tous les scrutins en base » pénalisait les députés d'une seule
 * législature dès qu'on a ingéré les scrutins historiques : leur présence
 * tombait de 89 % à 65 % faute d'avoir voté à des scrutins où ils ne siégeaient
 * pas encore. Un parlementaire à plusieurs mandats cumule naturellement ses
 * périodes — aucun cas particulier à coder.
 *
 * Renvoie `null` si la personne n'a aucun mandat connu : l'appelant se rabat
 * alors sur l'ancien comportement (toute la chambre).
 */
export function scrutinsDesMandats(
  chambre: string,
  mandats: { legislature: number | null; dateDebut: Date; dateFin: Date | null }[]
): Prisma.ScrutinWhereInput | null {
  const periodes: Prisma.ScrutinWhereInput[] = [];

  for (const mandat of mandats) {
    if (chambre === 'senat') {
      periodes.push({
        date: { gte: mandat.dateDebut, ...(mandat.dateFin ? { lte: mandat.dateFin } : {}) },
      });
    } else if (mandat.legislature != null) {
      periodes.push({ legislature: mandat.legislature });
    }
  }

  if (periodes.length === 0) return null;
  return { chambre, OR: periodes };
}

/**
 * Fragment SQL joignant le mandat qui couvre le scrutin, pour les agrégats
 * écrits en SQL brut. Les alias sont paramétrables afin de pouvoir joindre deux
 * fois le mandat dans une même requête (le votant et les membres de son groupe).
 *
 * Le `LEFT JOIN` garantit le repli : un votant sans mandat sur la période reste
 * compté, avec son groupe courant — d'où le `COALESCE(<mandat>.groupe_id,
 * <parlementaire>.groupe_id)` attendu côté appelant.
 */
export function joinMandatEpoque(
  vote: string,
  scrutin: string,
  mandat: string
): string {
  return `
  LEFT JOIN "mandats_parlementaires" ${mandat}
    ON ${mandat}.personne_id = ${vote}.parlementaire_id
   AND ${mandat}.chambre = ${scrutin}.chambre
   AND (
         (${scrutin}.chambre = 'assemblee' AND ${scrutin}.legislature IS NOT NULL
          AND ${mandat}.legislature = ${scrutin}.legislature)
      OR (${scrutin}.chambre = 'senat' AND ${mandat}.date_debut <= ${scrutin}.date
          AND (${mandat}.date_fin IS NULL OR ${mandat}.date_fin >= ${scrutin}.date))
       )
`;
}
