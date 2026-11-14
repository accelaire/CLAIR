import { Prisma, PrismaClient } from '@prisma/client';

// =============================================================================
// Bilan des gouvernements (SPEC-BILAN-MINISTRE.md) : projets de loi et leurs
// signataires, recours au 49.3, motions de censure, réponses en séance. Tables
// calculées chaque nuit par l'ingestion (`sync-bilan-gouvernement`) ; ici, on ne
// fait que les lire et les compter.
// =============================================================================

/** Début des données de bilan : 15e législature, gouvernement Philippe II. */
export const DEBUT_BILAN = '2017-06-21';

export const SOURCE_BILAN = {
  nom:
    'open data de l’Assemblée nationale (dossiers législatifs, scrutins, comptes rendus) et du Sénat ' +
    '(base DOSLEG pour les ministres des projets déposés au Sénat, comptes rendus)',
  url: 'https://data.assemblee-nationale.fr/travaux-parlementaires/dossiers-legislatifs',
} as const;

export const NATURES = ['ordinaire', 'ratification_ordonnance', 'convention', 'finances', 'constitutionnelle', 'organique'] as const;
export const STADES = ['promulgue', 'adopte', 'examine', 'depose'] as const;
type Nature = (typeof NATURES)[number];
type Stade = (typeof STADES)[number];

/**
 * Les textes « portés » au sens du chiffre de tête : hors ratifications
 * d'ordonnances (une formalité de l'article 38, rarement examinée) et hors
 * conventions internationales, comptées à part.
 */
export const NATURES_COMPTEES_A_PART: readonly Nature[] = ['ratification_ordonnance', 'convention'];

const jour = (d: Date): string => d.toISOString().slice(0, 10);

/** Un gouvernement fini avant juin 2017 n'a pas de données de bilan. */
export function couvertureBilan(dateFin: string | null): 'depuis_2017' | 'avant_2017' {
  return dateFin !== null && dateFin < DEBUT_BILAN ? 'avant_2017' : 'depuis_2017';
}

const zeros = <K extends string>(cles: readonly K[]) => Object.fromEntries(cles.map((c) => [c, 0])) as Record<K, number>;

/** Comptes d'une liste de projets : par nature, et par stade pour les textes portés. */
export function compterProjets(projets: ReadonlyArray<{ nature: string; stade: string }>) {
  const parNature = zeros(NATURES);
  const parStade = zeros(STADES);
  for (const p of projets) {
    if ((NATURES as readonly string[]).includes(p.nature)) parNature[p.nature as Nature]++;
    if (!NATURES_COMPTEES_A_PART.includes(p.nature as Nature) && (STADES as readonly string[]).includes(p.stade)) {
      parStade[p.stade as Stade]++;
    }
  }
  const total = projets.length;
  const portes = total - NATURES_COMPTEES_A_PART.reduce((n, k) => n + parNature[k], 0);
  return { total, portes, parNature, parStadePortes: parStade };
}

const selectionPersonne = {
  slug: true,
  acteurUid: true,
  civilite: true,
  prenom: true,
  nom: true,
  parlementaire: { select: { slug: true, chambre: true, photoUrl: true } },
} as const;

type PersonneLue = Prisma.MembreGouvernementGetPayload<{ select: typeof selectionPersonne }>;

function personne(p: PersonneLue) {
  return {
    slug: p.slug,
    acteurUid: p.acteurUid,
    civilite: p.civilite,
    prenom: p.prenom,
    nom: p.nom,
    parlementaire: p.parlementaire ? { slug: p.parlementaire.slug, chambre: p.parlementaire.chambre, photoUrl: p.parlementaire.photoUrl } : null,
  };
}

const selectionProjet = {
  nature: true,
  stade: true,
  chambreDepot: true,
  dateDepot: true,
  dossier: { select: { uid: true, titre: true, loiNumero: true, urlLegifrance: true } },
} as const;

type ProjetLu = Prisma.ProjetLoiGetPayload<{ select: typeof selectionProjet }>;

function projet(p: ProjetLu) {
  return {
    dossier: { uid: p.dossier.uid, titre: p.dossier.titre },
    nature: p.nature,
    stade: p.stade,
    chambreDepot: p.chambreDepot,
    dateDepot: jour(p.dateDepot),
    loi: p.dossier.loiNumero ? { numero: p.dossier.loiNumero, urlLegifrance: p.dossier.urlLegifrance } : null,
  };
}

export interface MotionLue {
  scrutinId: string;
  numero: number;
  chambre: string;
  session: string;
  date: Date;
  sort: string;
  nombrePour: number;
  majoriteRequise: string | null;
  alinea: number;
  premierSignataire: string | null;
  engagementDossierUid: string | null;
  gouvernementId: string;
  engagementDate: Date | null;
  texteUid: string | null;
  texteTitre: string | null;
}

function motion(m: MotionLue) {
  const requis = m.majoriteRequise ? Number.parseInt(m.majoriteRequise, 10) : NaN;
  return {
    date: jour(m.date),
    alinea: m.alinea,
    premierSignataire: m.premierSignataire,
    pour: m.nombrePour,
    // Majorité absolue des membres composant l'Assemblée, telle que publiée avec le scrutin.
    majoriteRequise: Number.isFinite(requis) ? requis : null,
    adoptee: m.sort === 'adopte',
    scrutin: { numero: m.numero, chambre: m.chambre, session: m.session },
    engagementDossierUid: m.engagementDossierUid,
  };
}

function bilanVide() {
  return {
    textes: null as null | {
      chefDeFile: ReturnType<typeof compterProjets>;
      cosignataire: number;
      liste: Array<{ role: string } & ReturnType<typeof projet>> | undefined;
    },
    reponses: { assemblee: 0, senat: 0 },
    premierMinistre: null as null | {
      engagements: number;
      motions: number;
      motionsAdoptees: number;
      listeEngagements: Array<{ date: string; dossier: { uid: string; titre: string }; texte: { uid: string; titre: string } | null }> | undefined;
      listeMotions: Array<ReturnType<typeof motion>> | undefined;
    },
  };
}

export type BilanPoste = ReturnType<typeof bilanVide>;

export class BilanGouvernements {
  constructor(private prisma: PrismaClient) {}

  private motions(where: Prisma.Sql) {
    return this.prisma.$queryRaw<MotionLue[]>`
      SELECT m.scrutin_id AS "scrutinId", s.numero, s.chambre, s.session, s.date, s.sort,
             s.nombre_pour AS "nombrePour",
             s.source_data->'syntheseVote'->>'nbrSuffragesRequis' AS "majoriteRequise",
             m.alinea, m.premier_signataire AS "premierSignataire", ed.uid AS "engagementDossierUid",
             m.gouvernement_id AS "gouvernementId", e.date AS "engagementDate",
             et.uid AS "texteUid", et.titre AS "texteTitre"
      FROM motions_censure m
      JOIN scrutins s ON s.id = m.scrutin_id
      LEFT JOIN engagements_responsabilite e ON e.id = m.engagement_id
      LEFT JOIN dossiers_legislatifs ed ON ed.id = e.dossier_id
      LEFT JOIN dossiers_legislatifs et ON et.id = e.dossier_texte_id
      WHERE ${where}
      ORDER BY s.date, s.numero`;
  }

  /** Le bilan d'un gouvernement, pour sa page. */
  async duGouvernement(gouvernementId: string) {
    const [projets, engagements, motions] = await Promise.all([
      this.prisma.projetLoi.findMany({
        where: { gouvernementId },
        orderBy: [{ dateDepot: 'desc' }, { id: 'asc' }],
        select: {
          ...selectionProjet,
          signataires: {
            where: { role: 'chef_de_file' },
            select: { poste: { select: { uid: true, intitule: true, intituleCourt: true, domaine: true, membre: { select: selectionPersonne } } } },
          },
        },
      }),
      this.prisma.engagementResponsabilite.findMany({
        where: { poste: { gouvernementId } },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        select: {
          date: true,
          dossier: { select: { uid: true, titre: true } },
          dossierTexte: { select: { uid: true, titre: true } },
        },
      }),
      this.motions(Prisma.sql`m.gouvernement_id = ${gouvernementId}`),
    ]);

    return {
      textes: {
        ...compterProjets(projets),
        liste: projets.map((p) => {
          const chef = p.signataires[0]?.poste;
          return {
            ...projet(p),
            chefDeFile: chef
              ? { posteUid: chef.uid, intitule: chef.intitule, intituleCourt: chef.intituleCourt, domaine: chef.domaine, membre: personne(chef.membre) }
              : null,
          };
        }),
      },
      engagements: engagements.map((e) => ({
        date: jour(e.date),
        dossier: e.dossier,
        texte: e.dossierTexte,
        motions: motions.filter((m) => m.engagementDossierUid === e.dossier.uid).map(motion),
      })),
      motions: {
        total: motions.length,
        alinea2: motions.filter((m) => m.alinea === 2).length,
        alinea3: motions.filter((m) => m.alinea === 3).length,
        adoptees: motions.filter((m) => m.sort === 'adopte').length,
        liste: motions.map(motion),
      },
    };
  }

  /**
   * Le projet de loi et les 49.3 de dossiers donnés (un dossier, ou ceux d'un
   * sujet). Un dossier « Engagement de la responsabilité » donne aussi son
   * engagement. Les gouvernements sont rendus par id : le service les nomme.
   */
  async desDossiers(dossierIds: readonly string[]) {
    const ids = [...dossierIds];
    const [projets, engagements] = await Promise.all([
      this.prisma.projetLoi.findMany({
        where: { dossierId: { in: ids } },
        orderBy: [{ dateDepot: 'asc' }, { id: 'asc' }],
        select: {
          ...selectionProjet,
          gouvernementId: true,
          signataires: {
            orderBy: [{ rang: 'asc' }, { id: 'asc' }],
            select: {
              role: true,
              poste: {
                select: {
                  uid: true, qualite: true, qualiteAccordee: true, intitule: true, intituleCourt: true,
                  membre: { select: selectionPersonne },
                },
              },
            },
          },
        },
      }),
      this.prisma.engagementResponsabilite.findMany({
        where: { OR: [{ dossierTexteId: { in: ids } }, { dossierId: { in: ids } }] },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          date: true,
          dossier: { select: { uid: true, titre: true } },
          dossierTexte: { select: { uid: true, titre: true } },
          poste: { select: { gouvernementId: true, membre: { select: selectionPersonne } } },
        },
      }),
    ]);
    const motions = engagements.length
      ? await this.motions(Prisma.sql`m.engagement_id = ANY(${engagements.map((e) => e.id)}::text[])`)
      : [];
    return {
      projets: projets.map((p) => ({
        ...projet(p),
        gouvernementId: p.gouvernementId,
        signataires: p.signataires.map((sg) => ({
          role: sg.role,
          qualite: sg.poste.qualiteAccordee ?? sg.poste.qualite,
          intitule: sg.poste.intitule,
          intituleCourt: sg.poste.intituleCourt,
          membre: personne(sg.poste.membre),
        })),
      })),
      engagements: engagements.map((e) => ({
        date: jour(e.date),
        dossier: e.dossier,
        texte: e.dossierTexte,
        gouvernementId: e.poste.gouvernementId,
        premierMinistre: personne(e.poste.membre),
        motions: motions.filter((m) => m.engagementDossierUid === e.dossier.uid).map(motion),
      })),
    };
  }

  /** La motion de censure qu'est ce scrutin, `null` s'il n'en est pas une. */
  async motionDuScrutin(scrutinId: string) {
    const [m] = await this.motions(Prisma.sql`m.scrutin_id = ${scrutinId}`);
    if (!m) return null;
    return {
      ...motion(m),
      gouvernementId: m.gouvernementId,
      engagement:
        m.engagementDossierUid && m.engagementDate
          ? {
              date: jour(m.engagementDate),
              dossierUid: m.engagementDossierUid,
              texte: m.texteUid ? { uid: m.texteUid, titre: m.texteTitre ?? '' } : null,
            }
          : null,
    };
  }

  /** Nombre de 49.3 et de motions par gouvernement, pour la liste. */
  async comptesParGouvernement(): Promise<Map<string, { engagements: number; motions: number }>> {
    const lignes = await this.prisma.$queryRaw<Array<{ gouvernementId: string; engagements: number; motions: number }>>`
      SELECT g.id AS "gouvernementId",
        (SELECT COUNT(*)::int FROM engagements_responsabilite e JOIN postes_ministeriels p ON p.id = e.poste_id WHERE p.gouvernement_id = g.id) AS engagements,
        (SELECT COUNT(*)::int FROM motions_censure m WHERE m.gouvernement_id = g.id) AS motions
      FROM gouvernements g`;
    return new Map(lignes.map((l) => [l.gouvernementId, { engagements: l.engagements, motions: l.motions }]));
  }

  /**
   * Bilan de chaque poste : textes signés (chef de file, cosignataire) et
   * réponses en séance par chambre ; pour un Premier ministre, ses 49.3 et les
   * motions votées contre son gouvernement pendant qu'il le dirigeait.
   * `details` ajoute les listes (page d'un membre) aux comptes (fiche).
   */
  async desPostes(posteIds: readonly string[], details: boolean) {
    if (posteIds.length === 0) return new Map<string, BilanPoste>();
    const ids = [...posteIds];
    const [postes, signatures, reponses, engagements] = await Promise.all([
      this.prisma.posteMinisteriel.findMany({
        where: { id: { in: ids } },
        select: { id: true, rangProtocolaire: true, gouvernementId: true, dateDebut: true, dateFin: true },
      }),
      this.prisma.projetLoiSignataire.findMany({
        where: { posteId: { in: ids }, role: { in: ['chef_de_file', 'cosignataire'] } },
        orderBy: [{ projet: { dateDepot: 'desc' } }, { id: 'asc' }],
        select: { posteId: true, role: true, projet: { select: selectionProjet } },
      }),
      this.prisma.$queryRaw<Array<{ posteId: string; chambre: string; n: number }>>`
        SELECT r.poste_id AS "posteId", i.chambre, COUNT(*)::int AS n
        FROM reponses_gouvernement r JOIN interventions i ON i.id = r.intervention_id
        WHERE r.poste_id = ANY(${ids}::text[])
        GROUP BY 1, 2`,
      this.prisma.engagementResponsabilite.findMany({
        where: { posteId: { in: ids } },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        select: { posteId: true, date: true, dossier: { select: { uid: true, titre: true } }, dossierTexte: { select: { uid: true, titre: true } } },
      }),
    ]);

    const postesPM = postes.filter((p) => p.rangProtocolaire === 1);
    const motionsPM = new Map<string, MotionLue[]>();
    await Promise.all(
      postesPM.map(async (p) => {
        const fin = p.dateFin ?? new Date('9999-12-31T00:00:00Z');
        motionsPM.set(
          p.id,
          await this.motions(Prisma.sql`m.gouvernement_id = ${p.gouvernementId} AND s.date::date BETWEEN ${p.dateDebut} AND ${fin}`),
        );
      }),
    );

    const resultat = new Map<string, BilanPoste>();
    for (const p of postes) {
      if (couvertureBilan(p.dateFin ? jour(p.dateFin) : null) === 'avant_2017') continue;
      const signes = signatures.filter((s) => s.posteId === p.id);
      const chef = signes.filter((s) => s.role === 'chef_de_file');
      const rep = reponses.filter((r) => r.posteId === p.id);
      const bilan = bilanVide();
      bilan.textes = {
        chefDeFile: compterProjets(chef.map((s) => s.projet)),
        cosignataire: signes.length - chef.length,
        liste: details ? signes.map((s) => ({ role: s.role, ...projet(s.projet) })) : undefined,
      };
      bilan.reponses = {
        assemblee: rep.find((r) => r.chambre === 'assemblee')?.n ?? 0,
        senat: rep.find((r) => r.chambre === 'senat')?.n ?? 0,
      };
      if (p.rangProtocolaire === 1) {
        const eng = engagements.filter((e) => e.posteId === p.id);
        const mot = motionsPM.get(p.id) ?? [];
        bilan.premierMinistre = {
          engagements: eng.length,
          motions: mot.length,
          motionsAdoptees: mot.filter((m) => m.sort === 'adopte').length,
          listeEngagements: details
            ? eng.map((e) => ({ date: jour(e.date), dossier: e.dossier, texte: e.dossierTexte }))
            : undefined,
          listeMotions: details ? mot.map(motion) : undefined,
        };
      }
      resultat.set(p.id, bilan);
    }
    return resultat;
  }
}
