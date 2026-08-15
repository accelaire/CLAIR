import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { SortantsQuery } from './senatoriales.schema';

const SCRUTIN_DATE = '2026-09-27';      // dimanche
const PRISE_DE_FONCTION = '2026-10-01';
const SERIE = '2';
const MANDATURE_SORTANTE = 2020;
const MANDATURE_ENTRANTE = 2026;
const EVENEMENT_SLUG = 'senatoriales-2026'; // table evenements_institutionnels

// Les mandats ouverts la veille du scrutin. Figé volontairement : après le
// renouvellement, la page devient une archive et doit continuer à décrire la
// mandature 2020-2026, pas la nouvelle.
const DATE_REFERENCE = new Date('2026-09-26T00:00:00.000Z');
const SCRUTIN_DATE_OBJ = new Date(`${SCRUTIN_DATE}T00:00:00.000Z`);
const MANDAT_COMPLET_DATE = new Date('2020-10-02T00:00:00.000Z');

export interface ApercuSenatoriales {
  scrutin: {
    date: string;
    priseDeFonction: string;
    serie: string;
    mandatureSortante: number;
    mandatureEntrante: number;
    nbSieges: number;
    nbCirconscriptions: number;
    sources: { label: string; url?: string }[];
  };
  sortants: {
    total: number;
    mandatComplet: number;
    arriveesEnCours: number;
    parGroupe: {
      slug: string;
      nom: string;
      nomComplet: string | null;
      couleur: string | null;
      position: string | null;
      sieges: number;
    }[];
  };
  // `departement` est le code INSEE ('01', '2A', '997') : il identifie à lui seul
  // une circonscription sénatoriale, qui en compte une par département.
  circonscriptions: {
    departement: string;
    nom: string;
    nbSieges: number;
  }[];
}

export interface Sortant {
  mandatId: string;
  personne: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    profession: string | null;
    dateNaissance: string | null;
  };
  groupe: {
    slug: string;
    nom: string;
    nomComplet: string | null;
    couleur: string | null;
    position: string | null;
  } | null;
  circonscription: {
    departement: string;
    nom: string;
  } | null;
  commissionPermanente: string | null;
  mandat: {
    dateDebut: string;
    dateFin: string | null;
    mandatComplet: boolean;
    dureeMois: number;
    // Un mandat peut être scindé en plusieurs lignes quand il a été interrompu
    // (entrée au gouvernement, remplacement temporaire). Le bilan agrège alors
    // tous les segments : la ligne encore ouverte, prise seule, ne couvrirait
    // qu'une fraction de la mandature.
    segments: number;
    interrompu: boolean;
  };
  bilan: {
    presence: number | null;
    presenceSolennel: number | null;
    loyaute: number | null;
    participation: number | null;
    interventions: number | null;
    amendements: number | null;
    amendementsAdoptes: number | null;
    questions: number | null;
    calculatedAt: string | null;
  };
}

// Entrée synthétique pour les mandats sans groupe rattaché : elle doit porter un
// slug stable, puisque l'API l'accepte aussi comme valeur de filtre.
const SANS_GROUPE = { slug: 'sans-groupe', nom: 'Sans groupe' };

const JOURS_PAR_MOIS = 30.44;
const MS_PAR_JOUR = 1000 * 60 * 60 * 24;

// Les mandats de la série 2 ouverts la veille du scrutin.
const MANDATS_SORTANTS: Prisma.MandatParlementaireWhereInput = {
  chambre: 'senat',
  serie: SERIE,
  mandature: MANDATURE_SORTANTE,
  dateDebut: { lte: DATE_REFERENCE },
  OR: [{ dateFin: null }, { dateFin: { gte: DATE_REFERENCE } }],
};

type CleTaux =
  | 'statsPresence'
  | 'statsPresenceSolennel'
  | 'statsLoyaute'
  | 'statsParticipation';

type CleCumul =
  | 'statsInterventions'
  | 'statsAmendements'
  | 'statsAmendementsAdoptes'
  | 'statsQuestions';

/** Durée couverte par un segment de mandat, bornée au jour du scrutin. */
export function joursCouverts(debut: Date, fin: Date | null): number {
  const borne = fin && fin < SCRUTIN_DATE_OBJ ? fin : SCRUTIN_DATE_OBJ;
  return Math.max(0, (borne.getTime() - debut.getTime()) / MS_PAR_JOUR);
}

/**
 * Moyenne d'un taux sur plusieurs segments, pondérée par leur durée.
 *
 * Une moyenne simple donnerait le même poids à quatre ans de mandat et à deux
 * mois de remplacement. Les segments sans mesure sont ignorés plutôt que comptés
 * pour zéro.
 */
export function moyennePonderee(valeurs: [number | null, number][]): number | null {
  const utiles = valeurs.filter(([v, poids]) => v !== null && poids > 0);
  if (utiles.length === 0) return null;
  const total = utiles.reduce((acc, [, poids]) => acc + poids, 0);
  if (total === 0) return null;
  return Math.round(utiles.reduce((acc, [v, poids]) => acc + v! * poids, 0) / total);
}

/** Somme d'un compteur sur plusieurs segments ; `null` si aucun segment n'en porte. */
export function somme(valeurs: (number | null)[]): number | null {
  const utiles = valeurs.filter((v): v is number => v !== null);
  if (utiles.length === 0) return null;
  return utiles.reduce((acc, v) => acc + v, 0);
}

/**
 * Départage commun à tous les tris.
 *
 * Sans lui, deux sortants à égalité s'ordonnent différemment d'un appel à
 * l'autre et la liste change d'ordre sous les yeux du lecteur.
 */
function parIdentite(a: Sortant, b: Sortant): number {
  return (
    a.personne.nom.localeCompare(b.personne.nom, 'fr') ||
    a.personne.prenom.localeCompare(b.personne.prenom, 'fr') ||
    a.mandatId.localeCompare(b.mandatId)
  );
}

/**
 * Le tri se fait en mémoire, sur le bilan agrégé — pas en SQL sur la ligne de
 * siège, dont les statistiques ne couvrent qu'un segment pour un mandat interrompu.
 * Trier en base afficherait un classement en désaccord avec les chiffres affichés.
 */
export function comparateur(tri: SortantsQuery['tri']): (a: Sortant, b: Sortant) => number {
  if (tri === 'nom') return parIdentite;

  if (tri === 'departement') {
    return (a, b) =>
      // Les codes INSEE sont sur deux caractères au moins ('01', '2A', '997') :
      // l'ordre lexicographique est donc l'ordre attendu.
      (a.circonscription?.departement ?? 'zzz').localeCompare(
        b.circonscription?.departement ?? 'zzz',
      ) || parIdentite(a, b);
  }

  const cle = {
    presence: 'presence',
    loyaute: 'loyaute',
    amendements: 'amendements',
    interventions: 'interventions',
  }[tri] as 'presence' | 'loyaute' | 'amendements' | 'interventions';

  return (a, b) => {
    const va = a.bilan[cle];
    const vb = b.bilan[cle];
    if (va === vb) return parIdentite(a, b);
    // Une statistique absente n'est pas une mauvaise performance : elle va en fin
    // de liste plutôt que de concurrencer les valeurs mesurées.
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  };
}

export class SenatorialesService {
  private readonly CACHE_TTL = 3600;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
  ) {}

  async getApercu(): Promise<ApercuSenatoriales> {
    const cacheKey = 'senatoriales:2026:apercu';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // L'aperçu dérive de la même liste que le détail : deux comptages issus de
    // requêtes distinctes finiraient par diverger sur les mandats interrompus.
    const [evenement, sortants] = await Promise.all([
      this.prisma.evenementInstitutionnel.findUnique({
        where: { slug: EVENEMENT_SLUG },
        select: { dateDebut: true, sources: true },
      }),
      this.chargerSortants(),
    ]);

    // La date de scrutin vient de l'agenda institutionnel, qui porte aussi les
    // sources officielles ; la constante ne sert que si la ligne manque.
    const date = evenement?.dateDebut
      ? new Date(evenement.dateDebut).toISOString().slice(0, 10)
      : SCRUTIN_DATE;
    const sources = (evenement?.sources as { label: string; url?: string }[] | null) ?? [];

    const total = sortants.length;
    const mandatComplet = sortants.filter((s) => s.mandat.mandatComplet).length;

    const groupes = new Map<string, ApercuSenatoriales['sortants']['parGroupe'][number]>();
    for (const sortant of sortants) {
      const slug = sortant.groupe?.slug ?? SANS_GROUPE.slug;
      const existant = groupes.get(slug);
      if (existant) {
        existant.sieges += 1;
        continue;
      }
      groupes.set(slug, {
        slug,
        nom: sortant.groupe?.nom ?? SANS_GROUPE.nom,
        nomComplet: sortant.groupe?.nomComplet ?? SANS_GROUPE.nom,
        couleur: sortant.groupe?.couleur ?? null,
        position: sortant.groupe?.position ?? null,
        sieges: 1,
      });
    }

    const parGroupe = Array.from(groupes.values())
      .filter((g) => g.slug !== SANS_GROUPE.slug)
      .sort((a, b) => b.sieges - a.sieges || a.nom.localeCompare(b.nom, 'fr'));

    // Les non-rattachés ferment la liste : ce n'est pas un groupe politique.
    const sansGroupe = groupes.get(SANS_GROUPE.slug);
    if (sansGroupe) parGroupe.push(sansGroupe);

    const circos = new Map<string, ApercuSenatoriales['circonscriptions'][number]>();
    for (const sortant of sortants) {
      const circo = sortant.circonscription;
      if (!circo) continue;
      const existant = circos.get(circo.departement);
      if (existant) existant.nbSieges += 1;
      else circos.set(circo.departement, { ...circo, nbSieges: 1 });
    }

    const circonscriptions = Array.from(circos.values()).sort((a, b) =>
      a.departement.localeCompare(b.departement),
    );

    const result: ApercuSenatoriales = {
      scrutin: {
        date,
        priseDeFonction: PRISE_DE_FONCTION,
        serie: SERIE,
        mandatureSortante: MANDATURE_SORTANTE,
        mandatureEntrante: MANDATURE_ENTRANTE,
        nbSieges: total,
        nbCirconscriptions: circonscriptions.length,
        sources,
      },
      sortants: {
        total,
        mandatComplet,
        arriveesEnCours: total - mandatComplet,
        parGroupe,
      },
      circonscriptions,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /**
   * Les 178 sièges remis en jeu, bilan agrégé, sans filtre ni tri.
   *
   * Le chargement est mutualisé : la liste tient en quelques centaines de
   * kilo-octets, et filtrer 178 lignes en mémoire coûte moins qu'un aller-retour
   * SQL par combinaison de filtres.
   */
  private async chargerSortants(): Promise<Sortant[]> {
    const cacheKey = 'senatoriales:2026:sortants:bruts';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as Sortant[];

    const sieges = await this.prisma.mandatParlementaire.findMany({
      where: MANDATS_SORTANTS,
      include: {
        personne: {
          select: {
            id: true,
            slug: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            profession: true,
            dateNaissance: true,
          },
        },
        groupe: {
          select: {
            slug: true,
            nom: true,
            nomComplet: true,
            couleur: true,
            position: true,
          },
        },
        circonscription: {
          select: {
            departement: true,
            nom: true,
          },
        },
      },
    });

    // Un mandat interrompu (entrée au gouvernement, notamment) est stocké en
    // plusieurs lignes. La ligne encore ouverte ne porte alors que les statistiques
    // de son propre segment : celle de Bruno Retailleau, ouverte le 22 octobre 2024,
    // affiche 46 % de présence là où la mandature complète en compte 98 puis 46.
    // Les publier telles quelles reviendrait à présenter une fraction du mandat
    // comme s'il s'agissait du bilan des six ans.
    const segments = await this.prisma.mandatParlementaire.findMany({
      where: {
        chambre: 'senat',
        serie: SERIE,
        mandature: MANDATURE_SORTANTE,
        personneId: { in: sieges.map((m) => m.personneId) },
      },
      select: {
        personneId: true,
        dateDebut: true,
        dateFin: true,
        statsPresence: true,
        statsPresenceSolennel: true,
        statsLoyaute: true,
        statsParticipation: true,
        statsInterventions: true,
        statsAmendements: true,
        statsAmendementsAdoptes: true,
        statsQuestions: true,
        statsCalculatedAt: true,
      },
    });

    const parPersonne = new Map<string, typeof segments>();
    for (const segment of segments) {
      const liste = parPersonne.get(segment.personneId);
      if (liste) liste.push(segment);
      else parPersonne.set(segment.personneId, [segment]);
    }

    const data: Sortant[] = sieges.map((siege) => {
      const mesSegments = parPersonne.get(siege.personneId) ?? [];
      const debut = mesSegments.reduce(
        (min, s) => (s.dateDebut < min ? s.dateDebut : min),
        siege.dateDebut,
      );

      const poids = mesSegments.map((s) => joursCouverts(s.dateDebut, s.dateFin));
      const taux = (cle: CleTaux) =>
        moyennePonderee(mesSegments.map((s, i) => [s[cle], poids[i] ?? 0]));
      const cumul = (cle: CleCumul) => somme(mesSegments.map((s) => s[cle]));

      const calculatedAt = mesSegments
        .map((s) => s.statsCalculatedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      return {
        mandatId: siege.id,
        // Les dates sont sérialisées ici plutôt que laissées en `Date` : sinon le
        // premier appel renvoie des objets et les suivants, relus du cache JSON,
        // des chaînes. Même charge utile HTTP, mais un seul type côté service.
        personne: {
          ...siege.personne,
          dateNaissance: siege.personne.dateNaissance?.toISOString() ?? null,
        },
        groupe: siege.groupe,
        circonscription: siege.circonscription,
        commissionPermanente: siege.commissionPermanente,
        mandat: {
          dateDebut: debut.toISOString(),
          dateFin: siege.dateFin?.toISOString() ?? null,
          mandatComplet: debut <= MANDAT_COMPLET_DATE,
          dureeMois: Math.max(
            0,
            Math.round(joursCouverts(debut, siege.dateFin) / JOURS_PAR_MOIS),
          ),
          segments: mesSegments.length,
          interrompu: mesSegments.length > 1,
        },
        bilan: {
          presence: taux('statsPresence'),
          presenceSolennel: taux('statsPresenceSolennel'),
          loyaute: taux('statsLoyaute'),
          participation: taux('statsParticipation'),
          interventions: cumul('statsInterventions'),
          amendements: cumul('statsAmendements'),
          amendementsAdoptes: cumul('statsAmendementsAdoptes'),
          questions: cumul('statsQuestions'),
          calculatedAt: calculatedAt?.toISOString() ?? null,
        },
      };
    });

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(data));
    return data;
  }

  async getSortants(query: SortantsQuery): Promise<{ data: Sortant[]; meta: { total: number } }> {
    const { departement, groupe, tri } = query;
    const cacheKey = `senatoriales:2026:sortants:${departement ?? 'tous'}:${groupe ?? 'tous'}:${tri}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const tous = await this.chargerSortants();

    const retenus = tous.filter((s) => {
      if (departement && s.circonscription?.departement !== departement) return false;
      if (groupe === 'sans-groupe') return s.groupe === null;
      if (groupe && s.groupe?.slug !== groupe) return false;
      return true;
    });

    const data = retenus.sort(comparateur(tri));
    const result = { data, meta: { total: data.length } };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }
}
