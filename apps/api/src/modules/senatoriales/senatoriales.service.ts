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
      /** Sièges du groupe remis en jeu le 27 septembre. */
      sieges: number;
      /**
       * Sièges du groupe dans le Sénat entier, série 1 comprise.
       *
       * Sans lui, le nombre de sièges renouvelés ne dit rien de l'enjeu : trente
       * sièges remis en jeu pèsent tout autrement selon qu'un groupe en compte
       * soixante ou trente-cinq. Le rapport des deux est le seul chiffre qui
       * indique qui joue gros.
       */
      siegesSenat: number;
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
    /** 'M' | 'F' tel que déduit de la civilité par la source. */
    sexe: string | null;
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
  /**
   * Statistiques de carrière de la personne — les mêmes que sa fiche. Il n'existe
   * pas d'équivalent carrière pour la présence en scrutin solennel, les amendements
   * adoptés ni les questions : ces mesures ne sont donc pas exposées ici.
   */
  bilan: {
    presence: number | null;
    loyaute: number | null;
    participation: number | null;
    interventions: number | null;
    amendements: number | null;
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



/** Durée couverte par un segment de mandat, bornée au jour du scrutin. */
export function joursCouverts(debut: Date, fin: Date | null): number {
  const borne = fin && fin < SCRUTIN_DATE_OBJ ? fin : SCRUTIN_DATE_OBJ;
  return Math.max(0, (borne.getTime() - debut.getTime()) / MS_PAR_JOUR);
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
 * Famille d'une catégorie professionnelle : la part qui précède la parenthèse.
 *
 * « Salariés (Cadres divers) » et « Salariés (Retraités) » relèvent de la même
 * famille. Exporté parce que l'affichage regroupe sur exactement la même clé :
 * deux découpages différents produiraient des sections dont le graphique ne
 * saurait plus rendre compte.
 */
export function familleProfession(profession: string | null): string | null {
  const valeur = profession?.trim();
  if (!valeur) return null;
  const [famille] = valeur.split(' (');
  return famille ? famille.trim() : valeur;
}

/**
 * Comparateur de regroupement : rassemble les sortants partageant une même clé,
 * clés par ordre alphabétique, sortants sans clé en fin de liste.
 *
 * Factorisé parce que groupe, commission et profession posent exactement le même
 * problème — ne jamais couper un ensemble en deux, ne jamais laisser les
 * non-renseignés s'intercaler au milieu — et qu'écrit trois fois, ce traitement
 * finirait par diverger sur l'un des trois.
 */
function parRegroupement(
  cle: (sortant: Sortant) => string | null,
): (a: Sortant, b: Sortant) => number {
  return (a, b) => {
    const cleA = cle(a);
    const cleB = cle(b);
    if (cleA === cleB) return parIdentite(a, b);
    if (!cleA) return 1;
    if (!cleB) return -1;
    return cleA.localeCompare(cleB, 'fr') || parIdentite(a, b);
  };
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

  if (tri === 'groupe') {
    // Rassemble les sortants d'un même groupe, groupes par ordre alphabétique.
    // L'ordre des groupes entre eux est laissé à l'affichage, qui les présente
    // en sections et peut vouloir les ranger par effectif ; ce qui se joue ici,
    // c'est seulement qu'un groupe ne soit jamais coupé en deux.
    return parRegroupement((s) => s.groupe?.nom ?? null);
  }

  if (tri === 'commission') {
    return parRegroupement((s) => s.commissionPermanente);
  }

  if (tri === 'profession') {
    // Regroupement sur la famille — « Salariés », « Fonctionnaires » — et non sur
    // la catégorie détaillée. Le Sénat en publie une vingtaine, du type
    // « Salariés (Cadres divers) » : prises telles quelles elles feraient des
    // sections d'un ou deux sortants, qui ne regroupent plus rien.
    return parRegroupement((s) => familleProfession(s.personne.profession));
  }

  if (tri === 'age') {
    // Du plus âgé au plus jeune : c'est la lecture attendue d'un « tri par âge »
    // sur une assemblée, celle qui met les doyens en tête.
    return (a, b) => {
      const na = a.personne.dateNaissance;
      const nb = b.personne.dateNaissance;
      if (na === nb) return parIdentite(a, b);
      // Une date de naissance inconnue n'est pas une jeunesse : elle ferme la liste.
      if (!na) return 1;
      if (!nb) return -1;
      // Naître plus tôt, c'est être plus âgé : l'ordre des dates est celui des âges.
      return na.localeCompare(nb) || parIdentite(a, b);
    };
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
    const [evenement, sortants, effectifsSenat] = await Promise.all([
      this.prisma.evenementInstitutionnel.findUnique({
        where: { slug: EVENEMENT_SLUG },
        select: { dateDebut: true, sources: true },
      }),
      this.chargerSortants(),
      this.effectifsParGroupe(),
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
        // `nomComplet` est nullable en base : un `??` ici ferait porter l'étiquette
        // « Sans groupe » à un groupe bien réel dont le libellé long manque. Le
        // repli sur la valeur sentinelle ne vaut que pour un mandat sans groupe.
        nomComplet: sortant.groupe ? sortant.groupe.nomComplet : SANS_GROUPE.nom,
        couleur: sortant.groupe?.couleur ?? null,
        position: sortant.groupe?.position ?? null,
        sieges: 1,
        // Un groupe absent du comptage global n'existe pas au Sénat d'aujourd'hui :
        // on retombe alors sur ses seuls sièges sortants plutôt que sur zéro, qui
        // afficherait une part remise en jeu infinie.
        siegesSenat: effectifsSenat.get(slug) ?? 0,
      });
    }

    // Le repli sur les sièges sortants se fait après le comptage : avant, il
    // porterait sur un total encore incomplet.
    for (const groupe of groupes.values()) {
      if (groupe.siegesSenat < groupe.sieges) groupe.siegesSenat = groupe.sieges;
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
   * Effectif de chaque groupe dans le Sénat entier, à la veille du scrutin.
   *
   * Sert de dénominateur à la part remise en jeu. Le comptage porte sur les
   * mandats ouverts des deux séries, sans filtre de mandature : la série 1 a été
   * renouvelée en 2023 et ne partage donc pas la mandature de la série 2.
   */
  private async effectifsParGroupe(): Promise<Map<string, number>> {
    const lignes = await this.prisma.mandatParlementaire.groupBy({
      by: ['groupeId'],
      where: {
        chambre: 'senat',
        dateDebut: { lte: DATE_REFERENCE },
        OR: [{ dateFin: null }, { dateFin: { gte: DATE_REFERENCE } }],
      },
      _count: { _all: true },
    });

    const groupeIds = lignes
      .map((l) => l.groupeId)
      .filter((id): id is string => id !== null);
    const groupes = await this.prisma.groupePolitique.findMany({
      where: { id: { in: groupeIds } },
      select: { id: true, slug: true },
    });
    const slugParId = new Map(groupes.map((g) => [g.id, g.slug]));

    const effectifs = new Map<string, number>();
    for (const ligne of lignes) {
      const slug = ligne.groupeId ? slugParId.get(ligne.groupeId) : SANS_GROUPE.slug;
      if (!slug) continue;
      effectifs.set(slug, (effectifs.get(slug) ?? 0) + ligne._count._all);
    }
    return effectifs;
  }

  /**
   * Les 178 sièges remis en jeu, bilan agrégé, sans filtre ni tri.
   *
   * Le chargement est mutualisé : la liste tient en quelques centaines de
   * kilo-octets, et filtrer 178 lignes en mémoire coûte moins qu'un aller-retour
   * SQL par combinaison de filtres.
   */
  /**
   * Les 178 sièges remis en jeu, sans filtre ni tri.
   *
   * Le bilan est lu dans les colonnes `stats_carriere_*` de la personne, celles-là
   * mêmes qu'affiche sa fiche : deux chiffres différents pour un même sénateur à un
   * clic d'écart seraient un défaut de crédibilité, et le lecteur n'a aucun moyen
   * de savoir lequel croire.
   *
   * Ce choix règle du même coup les mandats interrompus. Une entrée au gouvernement
   * scinde le mandat en plusieurs lignes, dont la dernière ne porte qu'une fraction
   * de la mandature — celle de Bruno Retailleau, ouverte le 22 octobre 2024, affiche
   * 46 % de présence. Les statistiques de carrière sont calculées sur les votes de
   * la personne et ignorent ce découpage.
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
            sexe: true,
            statsCarrierePresence: true,
            statsCarriereLoyaute: true,
            statsCarriereParticipation: true,
            statsCarriereInterventions: true,
            statsCarriereAmendements: true,
            statsCalculatedAt: true,
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

    // Les autres lignes de mandat de la mandature ne servent plus au bilan, mais
    // restent nécessaires pour dater le début réel du mandat : la ligne encore
    // ouverte d'un mandat interrompu ferait passer son titulaire pour une arrivée
    // en cours de mandature.
    const segments = await this.prisma.mandatParlementaire.findMany({
      where: {
        chambre: 'senat',
        serie: SERIE,
        mandature: MANDATURE_SORTANTE,
        personneId: { in: sieges.map((m) => m.personneId) },
      },
      select: { personneId: true, dateDebut: true },
    });

    const segmentsParPersonne = new Map<string, Date[]>();
    for (const segment of segments) {
      const dates = segmentsParPersonne.get(segment.personneId);
      if (dates) dates.push(segment.dateDebut);
      else segmentsParPersonne.set(segment.personneId, [segment.dateDebut]);
    }

    const data: Sortant[] = sieges.map((siege) => {
      const dates = segmentsParPersonne.get(siege.personneId) ?? [siege.dateDebut];
      const debut = dates.reduce((min, d) => (d < min ? d : min), siege.dateDebut);
      const { personne } = siege;

      return {
        mandatId: siege.id,
        // Les dates sont sérialisées ici plutôt que laissées en `Date` : sinon le
        // premier appel renvoie des objets et les suivants, relus du cache JSON,
        // des chaînes. Même charge utile HTTP, mais un seul type côté service.
        personne: {
          id: personne.id,
          slug: personne.slug,
          nom: personne.nom,
          prenom: personne.prenom,
          photoUrl: personne.photoUrl,
          profession: personne.profession,
          dateNaissance: personne.dateNaissance?.toISOString() ?? null,
          sexe: personne.sexe ?? null,
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
          segments: dates.length,
          interrompu: dates.length > 1,
        },
        bilan: {
          presence: personne.statsCarrierePresence,
          loyaute: personne.statsCarriereLoyaute,
          participation: personne.statsCarriereParticipation,
          interventions: personne.statsCarriereInterventions,
          amendements: personne.statsCarriereAmendements,
          calculatedAt: personne.statsCalculatedAt?.toISOString() ?? null,
        },
      };
    });

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(data));
    return data;
  }

  /**
   * Pas de cache par combinaison de filtres, volontairement.
   *
   * La version précédente indexait le résultat sur
   * `…:${departement ?? 'tous'}:${groupe ?? 'tous'}:${tri}`. Comme `departement`
   * n'est validé que comme une chaîne libre, un appel `?departement=tous`
   * reconstruisait mot pour mot la clé de l'appel sans filtre — et comme aucun
   * département ne porte ce nom, il y écrivait une liste vide pour une heure.
   * La page servait alors « aucun sortant » à tout le monde, rendu serveur
   * compris, au prix d'une seule requête anonyme.
   *
   * Plutôt que de rendre la clé injective, on retire l'étage de cache : il ne
   * servait à rien. Tout ce qui coûte (la requête SQL, l'agrégation des
   * segments) est déjà mémorisé par `chargerSortants`. Il ne reste ici qu'un
   * filtre et un tri sur 178 objets déjà en mémoire, soit quelques dizaines de
   * microsecondes — moins que l'aller-retour Redis qu'on vient de supprimer.
   */
  async getSortants(query: SortantsQuery): Promise<{ data: Sortant[]; meta: { total: number } }> {
    const { departement, groupe, tri } = query;

    const tous = await this.chargerSortants();

    const retenus = tous.filter((s) => {
      if (departement && s.circonscription?.departement !== departement) return false;
      if (groupe === 'sans-groupe') return s.groupe === null;
      if (groupe && s.groupe?.slug !== groupe) return false;
      return true;
    });

    // `filter` a déjà produit un tableau neuf : le tri ne touche pas la liste
    // mémorisée par `chargerSortants`.
    const data = retenus.sort(comparateur(tri));
    return { data, meta: { total: data.length } };
  }
}
