import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

// =============================================================================
// Gouvernements depuis 2007, postes ministériels et présidences de la
// République. Source : l'archive AMO30 de l'Assemblée nationale (organes
// GOUVERNEMENT, MINISTERE, PRESREP), relue chaque nuit. Chaque objet porte
// l'identifiant de la source (PO… pour un gouvernement ou une présidence, PM…
// pour un poste, PA… pour une personne) et les dates telles qu'elle les publie.
// =============================================================================

export const SOURCE_GOUVERNEMENTS = {
  // Le fichier porte aussi l'historique des députés : le nom dit ce qu'on y lit.
  nom: 'open data de l’Assemblée nationale, fichier « acteurs, mandats et organes » (AMO30)',
  url: 'https://data.assemblee-nationale.fr/acteurs/historique-des-deputes',
} as const;

/** Une date civile de la source, sans heure ni fuseau. */
const jour = (d: Date): string => d.toISOString().slice(0, 10);
const jourOuNull = (d: Date | null): string | null => (d ? jour(d) : null);

const ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Les domaines des portefeuilles, dans l'ordre où l'on présente un
 * gouvernement. Les clés sont celles qu'écrit l'ingestion dans
 * `postes_ministeriels.domaine` (services/ingestion/…/domaines-ministeriels.ts,
 * où se trouve la règle de classement) : les deux listes vont ensemble.
 */
export const DOMAINES = [
  { cle: 'premier-ministre', libelle: 'Premier ministre' },
  { cle: 'institutions', libelle: 'Institutions et action publique' },
  { cle: 'international', libelle: 'Europe et affaires étrangères' },
  { cle: 'defense', libelle: 'Armées et anciens combattants' },
  { cle: 'interieur', libelle: 'Intérieur et sécurité' },
  { cle: 'justice', libelle: 'Justice' },
  { cle: 'economie', libelle: 'Économie, finances et entreprises' },
  { cle: 'travail', libelle: 'Travail et emploi' },
  { cle: 'solidarites', libelle: 'Solidarités, familles et égalité' },
  { cle: 'sante', libelle: 'Santé' },
  { cle: 'education', libelle: 'Éducation et jeunesse' },
  { cle: 'recherche', libelle: 'Enseignement supérieur et recherche' },
  { cle: 'culture', libelle: 'Culture' },
  { cle: 'sports', libelle: 'Sports' },
  { cle: 'ecologie', libelle: 'Écologie et énergie' },
  { cle: 'transports', libelle: 'Transports' },
  { cle: 'agriculture', libelle: 'Agriculture et alimentation' },
  { cle: 'territoires', libelle: 'Territoires, logement et ville' },
  { cle: 'outre-mer', libelle: 'Outre-mer' },
] as const;

const selectionPersonne = {
  acteurUid: true,
  civilite: true,
  prenom: true,
  nom: true,
  parlementaire: { select: { slug: true, chambre: true, photoUrl: true } },
} as const;

interface PersonneLue {
  acteurUid: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  parlementaire: { slug: string; chambre: string; photoUrl: string | null } | null;
}

/** Une personne : nom seul, et sa fiche (avec sa photo) quand elle en a une. */
function personne(p: PersonneLue) {
  return {
    acteurUid: p.acteurUid,
    civilite: p.civilite,
    prenom: p.prenom,
    nom: p.nom,
    parlementaire: p.parlementaire
      ? { slug: p.parlementaire.slug, chambre: p.parlementaire.chambre, photoUrl: p.parlementaire.photoUrl }
      : null,
  };
}

/**
 * Le nom usuel de chaque gouvernement : celui de son Premier ministre, suivi
 * d'un chiffre romain quand ce Premier ministre en a dirigé plusieurs
 * (« Valls I », « Valls II », « Borne »). Le libellé de la source est
 * incohérent (« VALLS » puis « VALLS 2 », « LECORNU II ») et ne sert qu'au slug.
 */
export function nommerGouvernements<G extends { numero: number; premierMinistre: { acteurUid: string; nom: string } | null }>(
  gouvernements: readonly G[],
): Array<G & { nom: string }> {
  const parPremierMinistre = new Map<string, number>();
  for (const g of gouvernements) {
    if (g.premierMinistre) parPremierMinistre.set(g.premierMinistre.acteurUid, (parPremierMinistre.get(g.premierMinistre.acteurUid) ?? 0) + 1);
  }
  return gouvernements.map((g) => {
    const pm = g.premierMinistre;
    if (!pm) return { ...g, nom: '' };
    const plusieurs = (parPremierMinistre.get(pm.acteurUid) ?? 0) > 1;
    return { ...g, nom: plusieurs ? `${pm.nom} ${ROMAINS[g.numero] ?? g.numero}` : pm.nom };
  });
}

/**
 * La présidence pendant laquelle commence un gouvernement. Un gouvernement
 * peut enjamber une passation (Cazeneuve, nommé sous Hollande, finit sous
 * Macron) : seul le début compte.
 */
export function presidenceAuDebut<P extends { dateDebut: Date; dateFin: Date | null }>(
  presidences: readonly P[],
  debut: Date,
): P | null {
  const candidates = presidences.filter((p) => p.dateDebut <= debut && (p.dateFin === null || debut <= p.dateFin));
  return candidates.sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())[0] ?? null;
}

export class GouvernementsService {
  // Données relues une fois par nuit.
  private readonly CACHE_TTL = 3600;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
  ) {}

  /** Les 17 gouvernements nommés, du plus ancien au plus récent : base de toutes les réponses. */
  private async gouvernementsNommes() {
    const [gouvernements, presidences] = await Promise.all([
      this.prisma.gouvernement.findMany({
        orderBy: [{ dateDebut: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          uid: true,
          slug: true,
          numero: true,
          dateDebut: true,
          dateFin: true,
          postes: {
            select: { rangProtocolaire: true, dateDebut: true, uid: true, membreId: true, membre: { select: selectionPersonne } },
          },
        },
      }),
      this.prisma.presidence.findMany({
        orderBy: [{ dateDebut: 'asc' }, { id: 'asc' }],
        select: { uid: true, civilite: true, prenom: true, nom: true, dateDebut: true, dateFin: true },
      }),
    ]);

    return nommerGouvernements(
      gouvernements.map((g) => {
        // Le Premier ministre : le poste de rang 1 ouvert le premier jour du
        // gouvernement (check-quality garantit qu'il existe).
        const pm =
          g.postes
            .filter((p) => p.rangProtocolaire === 1)
            .sort(
              (a, b) =>
                Number(b.dateDebut.getTime() === g.dateDebut.getTime()) - Number(a.dateDebut.getTime() === g.dateDebut.getTime()) ||
                a.dateDebut.getTime() - b.dateDebut.getTime() ||
                a.uid.localeCompare(b.uid),
            )[0]?.membre ?? null;
        const presidence = presidenceAuDebut(presidences, g.dateDebut);
        return {
          id: g.id,
          uid: g.uid,
          slug: g.slug,
          numero: g.numero,
          dateDebut: jour(g.dateDebut),
          dateFin: jourOuNull(g.dateFin),
          enCours: g.dateFin === null,
          premierMinistre: pm ? personne(pm) : null,
          presidence: presidence
            ? { uid: presidence.uid, civilite: presidence.civilite, prenom: presidence.prenom, nom: presidence.nom }
            : null,
          nbPostes: g.postes.length,
          nbMembres: new Set(g.postes.map((p) => p.membreId)).size,
          // La civilité de la source : « Mme » ou « M. ».
          nbFemmes: new Set(g.postes.filter((p) => p.membre.civilite === 'Mme').map((p) => p.membreId)).size,
        };
      }),
    );
  }

  async getGouvernements() {
    const cacheKey = 'gouvernements:list';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const gouvernements = await this.gouvernementsNommes();
    // Le plus récent d'abord, comme on les lit.
    const result = {
      data: gouvernements.reverse().map(({ id: _id, ...g }) => g),
      source: SOURCE_GOUVERNEMENTS,
    };
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async getGouvernementBySlug(slug: string) {
    const cacheKey = `gouvernement:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const gouvernements = await this.gouvernementsNommes();
    const index = gouvernements.findIndex((g) => g.slug === slug);
    if (index === -1) return null;
    const { id, ...gouvernement } = gouvernements[index]!;

    const postes = await this.prisma.posteMinisteriel.findMany({
      where: { gouvernementId: id },
      // Ordre protocolaire, puis chronologique : un remaniement fait suivre
      // l'ancien titulaire du nouveau.
      orderBy: [{ rangProtocolaire: 'asc' }, { dateDebut: 'asc' }, { uid: 'asc' }],
      select: {
        uid: true,
        organeUid: true,
        qualite: true,
        qualiteAccordee: true,
        rangProtocolaire: true,
        intitule: true,
        intituleCourt: true,
        intituleComplement: true,
        domaine: true,
        dateDebut: true,
        dateFin: true,
        datePublication: true,
        membre: { select: selectionPersonne },
      },
    });

    const voisin = (g: (typeof gouvernements)[number] | undefined) => (g ? { slug: g.slug, nom: g.nom } : null);
    const result = {
      data: {
        ...gouvernement,
        precedent: voisin(gouvernements[index - 1]),
        suivant: voisin(gouvernements[index + 1]),
        postes: postes.map((p) => ({
          uid: p.uid,
          organeUid: p.organeUid,
          // La qualité accordée au titulaire (« Ministre déléguée »), à défaut la qualité.
          qualite: p.qualiteAccordee ?? p.qualite,
          rangProtocolaire: p.rangProtocolaire,
          intitule: p.intitule,
          intituleCourt: p.intituleCourt,
          intituleComplement: p.intituleComplement,
          domaine: p.domaine,
          dateDebut: jour(p.dateDebut),
          dateFin: jourOuNull(p.dateFin),
          datePublication: jourOuNull(p.datePublication),
          membre: personne(p.membre),
        })),
      },
      domaines: DOMAINES,
      source: SOURCE_GOUVERNEMENTS,
    };
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /**
   * Les fonctions gouvernementales et présidentielles d'un parlementaire, pour
   * sa fiche : chacune est une entrée de la frise de ses mandats, et non une
   * fonction rangée sous un mandat (un député nommé ministre cède son siège).
   */
  async getFonctionsGouvernementales(parlementaireId: string) {
    const [postes, presidences] = await Promise.all([
      this.prisma.posteMinisteriel.findMany({
        where: { membre: { parlementaireId } },
        orderBy: [{ dateDebut: 'desc' }, { uid: 'asc' }],
        select: {
          uid: true,
          qualite: true,
          qualiteAccordee: true,
          intitule: true,
          intituleCourt: true,
          dateDebut: true,
          dateFin: true,
          gouvernementId: true,
        },
      }),
      this.prisma.presidence.findMany({
        where: { parlementaireId },
        orderBy: [{ dateDebut: 'desc' }, { uid: 'asc' }],
        select: { uid: true, dateDebut: true, dateFin: true },
      }),
    ]);
    if (postes.length === 0 && presidences.length === 0) return [];

    const gouvernements = postes.length > 0 ? new Map((await this.gouvernementsNommes()).map((g) => [g.id, g])) : new Map();
    return [
      ...presidences.map((p) => ({
        type: 'presidence' as const,
        uid: p.uid,
        qualite: 'Président de la République',
        intitule: 'Présidence de la République',
        intituleCourt: null,
        dateDebut: jour(p.dateDebut),
        dateFin: jourOuNull(p.dateFin),
        gouvernement: null,
      })),
      ...postes.map((p) => {
        const g = gouvernements.get(p.gouvernementId);
        return {
          type: 'poste_ministeriel' as const,
          uid: p.uid,
          qualite: p.qualiteAccordee ?? p.qualite,
          intitule: p.intitule,
          intituleCourt: p.intituleCourt,
          dateDebut: jour(p.dateDebut),
          dateFin: jourOuNull(p.dateFin),
          gouvernement: g ? { uid: g.uid, slug: g.slug, nom: g.nom } : null,
        };
      }),
    ].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut) || a.uid.localeCompare(b.uid));
  }
}
