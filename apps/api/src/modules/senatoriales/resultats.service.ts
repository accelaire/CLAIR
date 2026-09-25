import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { SenatorialesService, type Sortant } from './senatoriales.service';
import { GRANDS_ELECTEURS } from './grands-electeurs';
import reference from './hemicycle-reference.json';

// =============================================================================
// Résultats des sénatoriales du 27 septembre 2026
// =============================================================================
//
// Les chiffres viennent du site de résultats du ministère de l'Intérieur, lu
// toutes les cinq minutes le soir du scrutin par la commande
// `sync-resultats-senatoriales`. Ils sont PROVISOIRES : le ministère les publie
// « sous réserve d'éventuelles corrections et des décisions du juge de
// l'élection ».
//
// L'état de chaque circonscription (vote en cours, 2nd tour à venir, pourvue…)
// se déduit de deux choses seulement : ce qui est publié, et l'heure. Les
// bureaux ouvrent et ferment à l'heure LOCALE, d'où les décalages horaires de
// l'outre-mer ci-dessous. Rien n'est supposé : une circonscription dont le
// scrutin est clos sans résultat publié est « résultats attendus ».
// =============================================================================

const SCRUTIN = 'senatoriales-2026';
const JOUR = '2026-09-27';
const CACHE_TTL = 60;

export const URL_SOURCE_RESULTATS =
  'https://www.resultats-elections.interieur.gouv.fr/senatoriales2026/';

/**
 * Décalage UTC de l'heure légale le 27 septembre 2026. L'outre-mer ne change
 * pas d'heure ; la métropole est à l'heure d'été.
 */
const DECALAGE_UTC: Record<string, string> = {
  '973': '-03:00', // Guyane
  '977': '-04:00', // Saint-Barthélemy
  '978': '-04:00', // Saint-Martin
  '986': '+12:00', // Wallis-et-Futuna
  '987': '-10:00', // Polynésie française (Papeete)
};

/** Horaires fixés par le décret n° 2026-301, en heure locale. */
export function horairesCirconscription(departement: string, modeScrutin: string) {
  const decalage = DECALAGE_UTC[departement] ?? '+02:00';
  const a = (heure: string) => new Date(`${JOUR}T${heure}:00${decalage}`).toISOString();
  return modeScrutin === 'proportionnel'
    ? { ouverture: a('08:30'), cloture: a('17:30'), ouvertureT2: null, clotureT2: null }
    : { ouverture: a('08:30'), cloture: a('11:00'), ouvertureT2: a('15:30'), clotureT2: a('17:30') };
}

export type StatutCirconscription =
  | 'pas_ouvert'
  | 'vote_en_cours'
  | 'resultats_attendus'
  | 'second_tour'
  | 'partielle'
  | 'pourvue';

export type EtapeSecondTour = 'a_venir' | 'en_cours' | 'clos';

interface TourLu {
  tour: number;
  elus: number;
}

/**
 * État d'une circonscription à un instant donné.
 *
 * `partielle` : au majoritaire à deux sièges, un élu au 1er tour et le second
 * siège au 2nd. `second_tour` : 1er tour publié, personne d'élu. L'étape du
 * 2nd tour dit si ses bureaux sont ouverts.
 */
export function statutCirconscription(
  departement: string,
  modeScrutin: string,
  nbSieges: number,
  tours: TourLu[],
  maintenant: Date,
): { statut: StatutCirconscription; secondTour: EtapeSecondTour | null } {
  const h = horairesCirconscription(departement, modeScrutin);
  const avant = (iso: string | null) => iso !== null && maintenant < new Date(iso);

  if (modeScrutin === 'proportionnel') {
    if (tours.some((t) => t.tour === 1)) return { statut: 'pourvue', secondTour: null };
    if (avant(h.ouverture)) return { statut: 'pas_ouvert', secondTour: null };
    if (avant(h.cloture)) return { statut: 'vote_en_cours', secondTour: null };
    return { statut: 'resultats_attendus', secondTour: null };
  }

  const elus = tours.reduce((total, t) => total + t.elus, 0);
  if (elus >= nbSieges || tours.some((t) => t.tour === 2)) return { statut: 'pourvue', secondTour: null };

  if (tours.some((t) => t.tour === 1)) {
    const secondTour: EtapeSecondTour = avant(h.ouvertureT2)
      ? 'a_venir'
      : avant(h.clotureT2)
        ? 'en_cours'
        : 'clos';
    return { statut: elus > 0 ? 'partielle' : 'second_tour', secondTour };
  }

  if (avant(h.ouverture)) return { statut: 'pas_ouvert', secondTour: null };
  if (avant(h.cloture)) return { statut: 'vote_en_cours', secondTour: null };
  return { statut: 'resultats_attendus', secondTour: null };
}

/**
 * Tableau de la plus forte moyenne : les moyennes de chaque liste pour les
 * diviseurs 1 à `sieges`, et le rang d'attribution de chaque siège.
 */
export function tableauPlusForteMoyenne(voix: number[], sieges: number) {
  const attribues = voix.map(() => 0);
  const rangs: { liste: number; diviseur: number; rang: number }[] = [];
  const moyenne = (i: number) => (voix[i] ?? 0) / ((attribues[i] ?? 0) + 1);
  for (let rang = 1; rang <= sieges && voix.length > 0; rang++) {
    let meilleur = 0;
    for (let i = 1; i < voix.length; i++) {
      if (moyenne(i) > moyenne(meilleur)) meilleur = i;
    }
    const diviseur = (attribues[meilleur] ?? 0) + 1;
    attribues[meilleur] = diviseur;
    rangs.push({ liste: meilleur, diviseur, rang });
  }
  return { attribues, rangs };
}

/**
 * L'heure qui décide des états. `SENATORIALES_HORLOGE` permet de rejouer une
 * étape de la soirée en local ; elle est ignorée en production.
 */
export function horloge(): Date {
  // Pour tester les états de la soirée en local seulement : jamais en production.
  const simulee = process.env.SENATORIALES_HORLOGE;
  if (simulee && process.env.NODE_ENV !== 'production') return new Date(simulee);
  return new Date();
}

export interface SiegeCirconscription {
  famille: string | null;
  nuance: string | null;
}

export interface Elu {
  nom: string;
  prenom: string;
  sexe: string | null;
  anneeNaissance: number | null;
  profession: string | null;
  tour: number;
  /** Libellé de la liste au proportionnel, `null` au majoritaire. */
  liste: string | null;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  /**
   * `reelu` : sortant de la série 2. `parlementaire` : déjà passé par le
   * Parlement (député en exercice ou ancien, ancien sénateur). `nouveau` : aucun
   * mandat parlementaire connu.
   */
  parcours: 'reelu' | 'parlementaire' | 'nouveau';
  personne: { slug: string; chambre: string; actif: boolean; photoUrl: string | null } | null;
}

export interface ResumeCirconscription {
  departement: string;
  nom: string;
  nbSieges: number;
  modeScrutin: string;
  statut: StatutCirconscription;
  secondTour: EtapeSecondTour | null;
  /** Un élément par siège, dans l'ordre d'attribution ; `null` = pas encore attribué. */
  sieges: (SiegeCirconscription | null)[];
  horaires: ReturnType<typeof horairesCirconscription>;
}

export interface ResultatsNationaux {
  maintenant: string;
  /** Dernière lecture du site du ministère, `null` avant la première. */
  verifieA: string | null;
  /** Dernier résultat apparu. */
  publieA: string | null;
  source: string;
  compteurs: Record<StatutCirconscription, number> & {
    circonscriptions: number;
    sieges: number;
    siegesAttribues: number;
  };
  circonscriptions: ResumeCirconscription[];
  hemicycle: {
    avant: Record<string, number>;
    apres: Record<string, number>;
    total: number;
    notes: string[];
  };
}

export interface LigneResultatDetail {
  sourceUid: string;
  libelle: string;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  voix: number;
  pctInscrits: number | null;
  pctExprimes: number | null;
  sieges: number | null;
  elu: boolean | null;
  /** Candidats de l'unité de vote, dans l'ordre de la liste. */
  candidats: {
    nom: string;
    prenom: string;
    sexe: string | null;
    anneeNaissance: number | null;
    profession: string | null;
    ordre: number;
    role: string;
    sortant: boolean;
    elu: boolean;
    personne: Elu['personne'];
  }[];
}

export interface ResultatsCirconscription {
  maintenant: string;
  source: string;
  circonscription: ResumeCirconscription & { grandsElecteurs: number | null };
  tours: {
    tour: number;
    publieA: string;
    verifieA: string;
    sourceUrl: string;
    participation: {
      inscrits: number;
      abstentions: number;
      votants: number;
      blancs: number;
      nuls: number;
      exprimes: number;
    };
    lignes: LigneResultatDetail[];
  }[];
  elus: Elu[];
  /** Au proportionnel, une fois publié : les moyennes qui ont attribué les sièges. */
  repartition: {
    listes: { sourceUid: string; libelle: string; famille: string | null; voix: number; moyennes: number[]; sieges: number }[];
    attributions: { sourceUid: string; diviseur: number; rang: number }[];
  } | null;
  sortants: (Sortant & { sort: 'reelu' | 'battu' | 'ne_se_representait_pas' | 'en_attente' })[];
}

interface ListeBrute {
  sourceUid: string;
  modeScrutin: string;
  libelle: string | null;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  departement: string;
  candidatures: {
    nom: string;
    prenom: string;
    sexe: string | null;
    anneeNaissance: number | null;
    professionLabel: string | null;
    ordre: number;
    role: string;
    personneId: string | null;
    personne: { slug: string; chambre: string; actif: boolean; photoUrl: string | null } | null;
  }[];
}

function titulaires(liste: ListeBrute) {
  return liste.candidatures.filter((c) => c.role === 'titulaire').sort((a, b) => a.ordre - b.ordre);
}

export class ResultatsService {
  private readonly senatoriales: SenatorialesService;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
  ) {
    this.senatoriales = new SenatorialesService(prisma, redis);
  }

  /** Données brutes, mémorisées une minute : c'est la cadence de la soirée. */
  private async charger() {
    const cacheKey = 'senatoriales:2026:resultats:bruts';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as Awaited<ReturnType<ResultatsService['lire']>>;
    const donnees = await this.lire();
    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(donnees));
    return donnees;
  }

  private async lire() {
    const [apercu, tours, lignes, listes] = await Promise.all([
      this.senatoriales.getApercu(),
      this.prisma.resultatTour.findMany({
        where: { scrutin: SCRUTIN },
        include: { circonscription: { select: { departement: true } } },
        orderBy: [{ tour: 'asc' }],
      }),
      this.prisma.resultatListe.findMany({
        where: { scrutin: SCRUTIN },
        include: { circonscription: { select: { departement: true } } },
        orderBy: [{ tour: 'asc' }, { voix: 'desc' }, { listeSourceUid: 'asc' }],
      }),
      this.prisma.candidatureListe.findMany({
        where: { scrutin: SCRUTIN },
        select: {
          sourceUid: true,
          modeScrutin: true,
          libelle: true,
          nuance: true,
          nuanceLibelle: true,
          famille: true,
          circonscription: { select: { departement: true } },
          candidatures: {
            select: {
              nom: true,
              prenom: true,
              sexe: true,
              anneeNaissance: true,
              professionLabel: true,
              ordre: true,
              role: true,
              personneId: true,
              personne: { select: { slug: true, chambre: true, actif: true, photoUrl: true } },
            },
            orderBy: [{ ordre: 'asc' }, { role: 'desc' }],
          },
        },
      }),
    ]);
    const sortants = await this.senatoriales.getSortants({ tri: 'nom' });

    return {
      apercu,
      tours: tours.map((t) => ({
        departement: t.circonscription.departement,
        tour: t.tour,
        inscrits: t.inscrits,
        abstentions: t.abstentions,
        votants: t.votants,
        blancs: t.blancs,
        nuls: t.nuls,
        exprimes: t.exprimes,
        sourceUrl: t.sourceUrl,
        publieA: t.publieA.toISOString(),
        verifieA: t.verifieA.toISOString(),
      })),
      lignes: lignes.map((l) => ({
        departement: l.circonscription.departement,
        tour: l.tour,
        sourceUid: l.listeSourceUid,
        voix: l.voix,
        pctInscrits: l.pctInscrits,
        pctExprimes: l.pctExprimes,
        sieges: l.sieges,
        elu: l.elu,
        libelleSource: l.libelleSource,
        nuanceSource: l.nuanceSource,
      })),
      listes: listes.map(
        (l): ListeBrute => ({
          sourceUid: l.sourceUid,
          modeScrutin: l.modeScrutin,
          libelle: l.libelle,
          nuance: l.nuance,
          nuanceLibelle: l.nuanceLibelle,
          famille: l.famille,
          departement: l.circonscription.departement,
          candidatures: l.candidatures,
        }),
      ),
      idsSortants: sortants.data.map((s) => s.personne.id),
    };
  }

  /** Élus d'une circonscription, dans l'ordre d'attribution des sièges. */
  private elus(
    departement: string,
    donnees: Awaited<ReturnType<ResultatsService['lire']>>,
  ): Elu[] {
    const idsSortants = new Set(donnees.idsSortants);
    const listes = new Map(donnees.listes.map((l) => [l.sourceUid, l]));
    const elus: Elu[] = [];

    const lignes = donnees.lignes.filter((l) => l.departement === departement);
    for (const ligne of lignes) {
      const liste = listes.get(ligne.sourceUid);
      const nombre = ligne.sieges ?? (ligne.elu ? 1 : 0);
      if (nombre === 0) continue;

      const candidats = liste ? titulaires(liste).slice(0, nombre) : [];
      for (const c of candidats) {
        elus.push({
          nom: c.nom,
          prenom: c.prenom,
          sexe: c.sexe,
          anneeNaissance: c.anneeNaissance,
          profession: c.professionLabel,
          tour: ligne.tour,
          liste: liste?.modeScrutin === 'proportionnel' ? liste.libelle : null,
          nuance: liste?.nuance ?? ligne.nuanceSource,
          nuanceLibelle: liste?.nuanceLibelle ?? null,
          famille: liste?.famille ?? null,
          parcours:
            c.personneId && idsSortants.has(c.personneId)
              ? 'reelu'
              : c.personne
                ? 'parlementaire'
                : 'nouveau',
          personne: c.personne,
        });
      }
      // Ligne non rattachée à nos candidatures : on connaît le siège, pas les
      // noms. On le compte sans inventer d'élu.
      if (!liste) {
        for (let i = 0; i < nombre; i++) {
          elus.push({
            nom: ligne.libelleSource,
            prenom: '',
            sexe: null,
            anneeNaissance: null,
            profession: null,
            tour: ligne.tour,
            liste: null,
            nuance: ligne.nuanceSource,
            nuanceLibelle: null,
            famille: null,
            parcours: 'nouveau',
            personne: null,
          });
        }
      }
    }
    return elus;
  }

  private resume(
    circo: { departement: string; nom: string; nbSieges: number },
    donnees: Awaited<ReturnType<ResultatsService['lire']>>,
    maintenant: Date,
  ): ResumeCirconscription {
    const modeScrutin =
      donnees.listes.find((l) => l.departement === circo.departement)?.modeScrutin ??
      (circo.nbSieges >= 3 ? 'proportionnel' : 'majoritaire');
    const tours = donnees.tours
      .filter((t) => t.departement === circo.departement)
      .map((t) => ({
        tour: t.tour,
        elus: donnees.lignes.filter((l) => l.departement === circo.departement && l.tour === t.tour && l.elu).length,
      }));
    const { statut, secondTour } = statutCirconscription(
      circo.departement,
      modeScrutin,
      circo.nbSieges,
      tours,
      maintenant,
    );
    const elus = this.elus(circo.departement, donnees);
    const sieges: (SiegeCirconscription | null)[] = elus
      .slice(0, circo.nbSieges)
      .map((e) => ({ famille: e.famille, nuance: e.nuance }));
    while (sieges.length < circo.nbSieges) sieges.push(null);

    return {
      departement: circo.departement,
      nom: circo.nom.replace(/\s*\(Série \d+\)\s*$/, '').trim(),
      nbSieges: circo.nbSieges,
      modeScrutin,
      statut,
      secondTour,
      sieges,
      horaires: horairesCirconscription(circo.departement, modeScrutin),
    };
  }

  async getNational(): Promise<ResultatsNationaux> {
    const donnees = await this.charger();
    const maintenant = horloge();
    const circonscriptions = donnees.apercu.circonscriptions.map((c) => this.resume(c, donnees, maintenant));

    const compteurs = {
      pas_ouvert: 0,
      vote_en_cours: 0,
      resultats_attendus: 0,
      second_tour: 0,
      partielle: 0,
      pourvue: 0,
      circonscriptions: circonscriptions.length,
      sieges: circonscriptions.reduce((t, c) => t + c.nbSieges, 0),
      siegesAttribues: circonscriptions.reduce((t, c) => t + c.sieges.filter(Boolean).length, 0),
    };
    for (const c of circonscriptions) compteurs[c.statut]++;

    // Hémicycle : une seule grille, la nuance du ministère à l'élection.
    const additionner = (...parts: Record<string, number>[]) => {
      const total: Record<string, number> = {};
      for (const part of parts) for (const [k, v] of Object.entries(part)) total[k] = (total[k] ?? 0) + v;
      return total;
    };
    const serie2Apres: Record<string, number> = {};
    for (const c of circonscriptions) {
      for (const siege of c.sieges) {
        const cle = siege === null ? 'non_attribue' : (siege.famille ?? 'non_classee');
        serie2Apres[cle] = (serie2Apres[cle] ?? 0) + 1;
      }
    }
    const avant = additionner(reference.serie1.parFamille, reference.serie2Avant.parFamille);
    const apres = additionner(reference.serie1.parFamille, serie2Apres);

    const dates = (cle: 'publieA' | 'verifieA') =>
      donnees.tours.map((t) => t[cle]).sort().at(-1) ?? null;

    return {
      maintenant: maintenant.toISOString(),
      verifieA: dates('verifieA'),
      publieA: dates('publieA'),
      source: URL_SOURCE_RESULTATS,
      compteurs,
      circonscriptions,
      hemicycle: {
        avant,
        apres,
        total: 348,
        notes: [
          'Chaque siège est classé par la famille de la nuance que le ministère de l\'Intérieur a attribuée à son titulaire lors de son élection : 2023 pour la série 1, 2020 pour la série 2 avant le scrutin, 2026 après.',
          reference.serie2Avant.note,
          'Une nuance n\'est pas un groupe politique. Les groupes du Sénat se constituent le 5 octobre.',
        ],
      },
    };
  }

  async getCirconscription(departement: string): Promise<ResultatsCirconscription | null> {
    const donnees = await this.charger();
    const circo = donnees.apercu.circonscriptions.find((c) => c.departement === departement);
    if (!circo) return null;
    const maintenant = horloge();
    const resume = this.resume(circo, donnees, maintenant);
    const listes = new Map(donnees.listes.map((l) => [l.sourceUid, l]));
    const idsSortants = new Set(donnees.idsSortants);
    const elus = this.elus(departement, donnees);
    const clefsElus = new Set(elus.map((e) => `${e.nom}|${e.prenom}`));

    const tours = donnees.tours
      .filter((t) => t.departement === departement)
      .map((t) => ({
        tour: t.tour,
        publieA: t.publieA,
        verifieA: t.verifieA,
        sourceUrl: t.sourceUrl,
        participation: {
          inscrits: t.inscrits,
          abstentions: t.abstentions,
          votants: t.votants,
          blancs: t.blancs,
          nuls: t.nuls,
          exprimes: t.exprimes,
        },
        lignes: donnees.lignes
          .filter((l) => l.departement === departement && l.tour === t.tour)
          .map((l): LigneResultatDetail => {
            const liste = listes.get(l.sourceUid);
            const nombre = l.sieges ?? (l.elu ? 1 : 0);
            return {
              sourceUid: l.sourceUid,
              libelle:
                liste?.modeScrutin === 'proportionnel'
                  ? (liste.libelle ?? l.libelleSource)
                  : liste
                    ? `${titulaires(liste)[0]?.prenom ?? ''} ${titulaires(liste)[0]?.nom ?? ''}`.trim()
                    : l.libelleSource,
              nuance: liste?.nuance ?? l.nuanceSource,
              nuanceLibelle: liste?.nuanceLibelle ?? null,
              famille: liste?.famille ?? null,
              voix: l.voix,
              pctInscrits: l.pctInscrits,
              pctExprimes: l.pctExprimes,
              sieges: l.sieges,
              elu: l.elu,
              candidats: (liste?.candidatures ?? []).map((c) => ({
                nom: c.nom,
                prenom: c.prenom,
                sexe: c.sexe,
                anneeNaissance: c.anneeNaissance,
                profession: c.professionLabel,
                ordre: c.ordre,
                role: c.role,
                sortant: c.personneId !== null && idsSortants.has(c.personneId),
                elu: c.role === 'titulaire' && c.ordre <= nombre && clefsElus.has(`${c.nom}|${c.prenom}`),
                personne: c.personne,
              })),
            };
          }),
      }));

    // Plus forte moyenne recalculée depuis les voix : le tableau n'est montré
    // que s'il retombe exactement sur les sièges publiés par le ministère.
    let repartition: ResultatsCirconscription['repartition'] = null;
    const tour1 = tours.find((t) => t.tour === 1);
    if (resume.modeScrutin === 'proportionnel' && tour1) {
      const lignes = tour1.lignes;
      const { attribues, rangs } = tableauPlusForteMoyenne(
        lignes.map((l) => l.voix),
        resume.nbSieges,
      );
      if (lignes.every((l, i) => (l.sieges ?? 0) === attribues[i])) {
        repartition = {
          listes: lignes.map((l, i) => ({
            sourceUid: l.sourceUid,
            libelle: l.libelle,
            famille: l.famille,
            voix: l.voix,
            moyennes: Array.from({ length: resume.nbSieges }, (_, k) => Math.round((l.voix / (k + 1)) * 10) / 10),
            sieges: attribues[i] ?? 0,
          })),
          attributions: rangs.map((r) => ({
            sourceUid: lignes[r.liste]?.sourceUid ?? '',
            diviseur: r.diviseur,
            rang: r.rang,
          })),
        };
      }
    }

    const { data: sortantsCirco } = await this.senatoriales.getSortants({ departement, tri: 'nom' });
    const elusIds = new Set(
      elus.filter((e) => e.parcours === 'reelu' && e.personne).map((e) => e.personne!.slug),
    );
    const sortants = sortantsCirco.map((s) => {
      let sort: 'reelu' | 'battu' | 'ne_se_representait_pas' | 'en_attente';
      if (!s.candidature) sort = 'ne_se_representait_pas';
      else if (elusIds.has(s.personne.slug)) sort = 'reelu';
      else if (resume.statut === 'pourvue') sort = 'battu';
      else sort = 'en_attente';
      return { ...s, sort };
    });

    return {
      maintenant: maintenant.toISOString(),
      source: URL_SOURCE_RESULTATS,
      circonscription: { ...resume, grandsElecteurs: GRANDS_ELECTEURS[departement] ?? null },
      tours,
      elus,
      repartition,
      sortants,
    };
  }
}

