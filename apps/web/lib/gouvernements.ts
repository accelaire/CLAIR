// Gouvernements, postes ministériels et présidences : types de l'API
// (`/api/v1/gouvernements`) et règles d'affichage. Les dates sont des dates
// civiles de la source (`YYYY-MM-DD`), sans heure ni fuseau.

export interface PersonneGouvernement {
  /** Slug de membre (`/gouvernements/membres/:slug`) ; absent d'une réponse mise en cache avant la page des membres. */
  slug?: string;
  acteurUid: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  /** Fiche CLAIR de la personne, quand elle en a une. Sinon, son nom seul. */
  parlementaire: { slug: string; chambre: string; photoUrl: string | null } | null;
  /** Sans fiche : photo de Wikidata et son crédit. Absente d'une réponse ancienne. */
  photo?: PhotoCommons | null;
}

/** Photo de Wikimedia Commons, toujours affichée avec son crédit. */
export interface PhotoCommons {
  url: string;
  auteur: string | null;
  licence: string;
  licenceUrl: string | null;
  /** Page du fichier sur Commons */
  source: string;
}

/** La photo de la fiche, sinon celle de Wikidata. */
export function photoDe(p: { parlementaire?: { photoUrl: string | null } | null; photo?: PhotoCommons | null }): string | null {
  return p.parlementaire?.photoUrl ?? p.photo?.url ?? null;
}

/** Crédit d'une photo de Commons en une ligne : « Photo : Auteur, CC BY-SA 4.0, Wikimedia Commons ». */
export function creditPhoto(photo: PhotoCommons): string {
  return `Photo : ${photo.auteur ? `${photo.auteur}, ` : ''}${photo.licence}, Wikimedia Commons`;
}

export interface GouvernementResume {
  uid: string;
  slug: string;
  /** « Valls II », « Borne » : sans le mot « Gouvernement ». */
  nom: string;
  numero: number;
  dateDebut: string;
  dateFin: string | null;
  enCours: boolean;
  premierMinistre: PersonneGouvernement | null;
  /** `slug` et `parlementaire` : sa page de membre ou sa fiche, null sans page ; absents d'une réponse ancienne. */
  presidence: {
    uid: string;
    civilite: string | null;
    prenom: string;
    nom: string;
    slug?: string | null;
    parlementaire?: PersonneGouvernement['parlementaire'];
    photo?: PhotoCommons | null;
  } | null;
  nbPostes: number;
  nbMembres: number;
  /** Membres dont la civilité publiée est « Mme ». */
  nbFemmes: number;
  /** Absents d'une réponse mise en cache avant le déploiement du bilan. */
  couverture?: Couverture;
  /** Recours au 49.3 et motions de censure ; null avant juin 2017. */
  bilan?: { engagements: number; motions: number } | null;
}

/** « avant_2017 » : pas de données de bilan (ni dossiers ni scrutins avant la 15e législature). */
export type Couverture = 'depuis_2017' | 'avant_2017';

export type NatureProjet = 'ordinaire' | 'ratification_ordonnance' | 'convention' | 'finances' | 'constitutionnelle' | 'organique';
export type StadeProjet = 'promulgue' | 'adopte' | 'examine' | 'depose';

export interface ProjetLoi {
  dossier: { uid: string; titre: string };
  nature: NatureProjet;
  stade: StadeProjet;
  chambreDepot: 'assemblee' | 'senat';
  dateDepot: string;
  loi: { numero: string; urlLegifrance: string | null } | null;
}

export interface ComptesProjets {
  total: number;
  /** Hors ratifications d'ordonnances et conventions, comptées à part. */
  portes: number;
  parNature: Record<NatureProjet, number>;
  parStadePortes: Record<StadeProjet, number>;
}

export interface MotionCensure {
  date: string;
  alinea: number;
  premierSignataire: string | null;
  pour: number;
  majoriteRequise: number | null;
  adoptee: boolean;
  scrutin: { numero: number; chambre: string; session: string };
  engagementDossierUid: string | null;
}

export interface Engagement {
  date: string;
  dossier: { uid: string; titre: string };
  texte: { uid: string; titre: string } | null;
}

export interface BilanGouvernement {
  textes: ComptesProjets & {
    liste: Array<ProjetLoi & {
      chefDeFile: { posteUid: string; intitule: string; intituleCourt: string | null; domaine: string | null; membre: PersonneGouvernement } | null;
    }>;
  };
  engagements: Array<Engagement & { motions: MotionCensure[] }>;
  motions: { total: number; alinea2: number; alinea3: number; adoptees: number; liste: MotionCensure[] };
}

/** Un gouvernement désigné dans une autre page (dossier, scrutin). */
export interface RepereGouvernement {
  slug: string;
  nom: string;
}

/**
 * Contexte gouvernemental d'un dossier ou d'un sujet (`gouvernement` de
 * `/dossiers/:uid` et `/sujets/:slug`) : le projet de loi et ses signataires,
 * les recours au 49.3 sur ce texte et leurs motions de censure.
 */
export interface ContexteGouvernemental {
  projets: Array<ProjetLoi & {
    gouvernement: RepereGouvernement | null;
    signataires: Array<{
      role: 'premier_ministre' | 'chef_de_file' | 'cosignataire';
      qualite: string;
      intitule: string;
      intituleCourt: string | null;
      membre: PersonneGouvernement & { slug: string };
    }>;
  }>;
  engagements: Array<Engagement & {
    gouvernement: RepereGouvernement | null;
    premierMinistre: PersonneGouvernement & { slug: string };
    motions: MotionCensure[];
  }>;
}

/** Une motion de censure vue depuis la page de son scrutin (`motionCensure` de `/scrutins/:numero`). */
export interface MotionDuScrutin extends MotionCensure {
  gouvernement: RepereGouvernement | null;
  engagement: { date: string; dossierUid: string; texte: { uid: string; titre: string } | null } | null;
}

/** Bilan d'un poste : comptes sur la fiche, listes sur la page d'un membre. */
export interface BilanPoste {
  textes: { chefDeFile: ComptesProjets; cosignataire: number; liste?: Array<ProjetLoi & { role: string }> } | null;
  reponses: { assemblee: number; senat: number };
  premierMinistre: {
    engagements: number;
    motions: number;
    motionsAdoptees: number;
    listeEngagements?: Engagement[];
    listeMotions?: MotionCensure[];
  } | null;
}

export const LIBELLES_STADE: Record<StadeProjet, string> = {
  promulgue: 'promulgué',
  adopte: 'adopté, pas encore promulgué',
  examine: 'examiné, sans adoption définitive',
  depose: 'déposé, jamais examiné en séance',
};

export const LIBELLES_NATURE: Record<NatureProjet, string> = {
  ordinaire: 'projet de loi',
  ratification_ordonnance: 'ratification d’ordonnance',
  convention: 'convention internationale',
  finances: 'loi de finances ou de financement de la sécurité sociale',
  constitutionnelle: 'révision constitutionnelle',
  organique: 'loi organique',
};

/** Pluriel simple : « 1 texte », « 3 textes ». */
export function nombre(n: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${n.toLocaleString('fr-FR')} ${n > 1 ? pluriel : singulier}`;
}

export interface PosteMinisteriel {
  uid: string;
  organeUid: string;
  qualite: string;
  rangProtocolaire: number;
  intitule: string;
  intituleCourt: string | null;
  intituleComplement: string | null;
  /** Clé du domaine (« economie », « sante »), null pour un intitulé nouveau. */
  domaine: string | null;
  dateDebut: string;
  dateFin: string | null;
  datePublication: string | null;
  membre: PersonneGouvernement;
}

export interface GouvernementDetail extends Omit<GouvernementResume, 'bilan'> {
  precedent: { slug: string; nom: string } | null;
  suivant: { slug: string; nom: string } | null;
  postes: PosteMinisteriel[];
  /** null avant juin 2017 (`couverture` = « avant_2017 ») ; absent d'une réponse antérieure au bilan. */
  bilan?: BilanGouvernement | null;
}

export interface SourceGouvernements {
  nom: string;
  url: string;
}

export interface Domaine {
  cle: string;
  libelle: string;
}

/** Une fonction gouvernementale ou présidentielle, sur la fiche d'un parlementaire. */
export interface FonctionGouvernementale {
  type: 'poste_ministeriel' | 'presidence';
  uid: string;
  qualite: string;
  intitule: string;
  intituleCourt: string | null;
  /** Rang protocolaire et domaine du portefeuille ; null pour une présidence, absents d'une réponse ancienne. */
  rangProtocolaire?: number | null;
  domaine?: string | null;
  dateDebut: string;
  dateFin: string | null;
  gouvernement: { uid: string; slug: string; nom: string } | null;
  /** Slug du membre (`/gouvernements/membres/:slug`) ; absent d'une réponse antérieure au bilan. */
  membreSlug?: string | null;
  /** Comptes du poste ; null avant juin 2017 ou pour une présidence. */
  bilan?: BilanPoste | null;
}

/**
 * Une entrée de la frise d'une fiche : un poste, ou plusieurs postes
 * reconduits d'un gouvernement à l'autre (cf. `regrouperPostes`).
 */
export interface EntreeGouvernementale {
  /** Du plus récent au plus ancien ; le premier donne le libellé. */
  postes: FonctionGouvernementale[];
  dateDebut: string;
  dateFin: string | null;
  /** Les gouvernements traversés, du plus ancien au plus récent, sans doublon. */
  gouvernements: Array<{ slug: string; nom: string }>;
  /** Somme des bilans des postes ; null si aucun n'en a (avant juin 2017, présidence). */
  bilan: BilanPoste | null;
}

const JOUR_MS = 86_400_000;

/**
 * Écart maximal entre la fin d'un poste et le début du suivant pour y voir une
 * reconduction : la source clôt un poste à la démission du gouvernement et
 * date le suivant de la nomination des ministres, jusqu'à 26 jours après
 * (Lecornu I). Mesuré en prod le 13/11/2026 : aucun poste consécutif sans
 * domaine.
 */
const ECART_RECONDUCTION_JOURS = 45;

/**
 * Les fonctions gouvernementales d'une fiche, avec les postes reconduits
 * regroupés : même domaine et même rang protocolaire, sans interruption de
 * plus de 45 jours. Sébastien Lecornu, ministre des Armées dans quatre
 * gouvernements (dont un intitulé « Armées et anciens combattants »), avait
 * quatre entrées avant d'atteindre ses mandats ; il en a une. Une présidence
 * n'est jamais regroupée. Les entrées vont du plus récent au plus ancien.
 */
export function regrouperPostes(fonctions: readonly FonctionGouvernementale[]): EntreeGouvernementale[] {
  const tries = [...fonctions].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut) || a.uid.localeCompare(b.uid));
  const groupes: FonctionGouvernementale[][] = [];
  for (const f of tries) {
    const groupe = groupes[groupes.length - 1];
    // Le plus ancien poste du groupe en cours, qui suit `f` dans le temps.
    const suivant = groupe?.[groupe.length - 1];
    if (groupe && suivant && seProlongeDans(f, suivant)) groupe.push(f);
    else groupes.push([f]);
  }
  return groupes.map((postes) => {
    const gouvernements: Array<{ slug: string; nom: string }> = [];
    for (const p of [...postes].reverse()) {
      if (p.gouvernement && !gouvernements.some((g) => g.slug === p.gouvernement!.slug)) {
        gouvernements.push({ slug: p.gouvernement.slug, nom: p.gouvernement.nom });
      }
    }
    return {
      postes,
      dateDebut: postes[postes.length - 1]!.dateDebut,
      dateFin: postes[0]!.dateFin,
      gouvernements,
      bilan: cumulerBilans(postes.map((p) => p.bilan)),
    };
  });
}

/** Le poste `ancien` est reconduit dans `suivant`, qui commence après sa fin. */
function seProlongeDans(ancien: FonctionGouvernementale, suivant: FonctionGouvernementale): boolean {
  if (suivant.type !== 'poste_ministeriel' || ancien.type !== 'poste_ministeriel') return false;
  if (!suivant.domaine || suivant.domaine !== ancien.domaine) return false;
  if (suivant.rangProtocolaire == null || suivant.rangProtocolaire !== ancien.rangProtocolaire) return false;
  if (ancien.dateFin === null) return false;
  const ecart = (dateCivile(suivant.dateDebut).getTime() - dateCivile(ancien.dateFin).getTime()) / JOUR_MS;
  return ecart >= 0 && ecart <= ECART_RECONDUCTION_JOURS;
}

function sommeParCle<K extends string>(a: Record<K, number>, b: Record<K, number>): Record<K, number> {
  const somme = { ...a };
  for (const cle of Object.keys(b) as K[]) somme[cle] = (somme[cle] ?? 0) + b[cle];
  return somme;
}

function cumulerComptes(a: ComptesProjets, b: ComptesProjets): ComptesProjets {
  return {
    total: a.total + b.total,
    portes: a.portes + b.portes,
    parNature: sommeParCle(a.parNature, b.parNature),
    parStadePortes: sommeParCle(a.parStadePortes, b.parStadePortes),
  };
}

const concatener = <T>(a: T[] | undefined, b: T[] | undefined): T[] | undefined =>
  a === undefined && b === undefined ? undefined : [...(a ?? []), ...(b ?? [])];

/**
 * La somme de bilans de postes : comptes additionnés, listes mises bout à
 * bout. Un projet de loi n'est signé que dans un poste à la fois (celui
 * qu'occupe le ministre à son dépôt) : la somme ne le compte pas deux fois.
 * Null si aucun poste n'a de bilan.
 */
export function cumulerBilans(bilans: ReadonlyArray<BilanPoste | null | undefined>): BilanPoste | null {
  const presents = bilans.filter((b): b is BilanPoste => !!b);
  if (presents.length === 0) return null;
  return presents.reduce((a, b) => ({
    textes:
      a.textes && b.textes
        ? {
            chefDeFile: cumulerComptes(a.textes.chefDeFile, b.textes.chefDeFile),
            cosignataire: a.textes.cosignataire + b.textes.cosignataire,
            liste: concatener(a.textes.liste, b.textes.liste),
          }
        : (a.textes ?? b.textes),
    reponses: { assemblee: a.reponses.assemblee + b.reponses.assemblee, senat: a.reponses.senat + b.reponses.senat },
    premierMinistre:
      a.premierMinistre && b.premierMinistre
        ? {
            engagements: a.premierMinistre.engagements + b.premierMinistre.engagements,
            motions: a.premierMinistre.motions + b.premierMinistre.motions,
            motionsAdoptees: a.premierMinistre.motionsAdoptees + b.premierMinistre.motionsAdoptees,
            listeEngagements: concatener(a.premierMinistre.listeEngagements, b.premierMinistre.listeEngagements),
            listeMotions: concatener(a.premierMinistre.listeMotions, b.premierMinistre.listeMotions),
          }
        : (a.premierMinistre ?? b.premierMinistre),
  }));
}

/** Une date civile de la source affichée sans décalage de fuseau. */
function dateCivile(jour: string): Date {
  return new Date(`${jour}T12:00:00Z`);
}

export function dateLongue(jour: string): string {
  return dateCivile(jour).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function moisAnnee(jour: string): string {
  return dateCivile(jour).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * L'intitulé court d'un portefeuille, sans les précisions que l'AN ajoute pour
 * distinguer deux organes de même nom (« Fonction publique (II) »,
 * « Écologie (M. le SE auprès du ministre d'État) », « Justice (garde des
 * sceaux) ») : elles n'apprennent rien au lecteur. Une parenthèse qui complète
 * le titre (« affaires étrangères (et européennes) ») est gardée. La donnée
 * brute reste dans l'API.
 */
export function intituleAffiche(intituleCourt: string | null, intitule: string): string {
  const brut = intituleCourt ?? intitule;
  const sansPrecision = brut.replace(/\s*\((?!et\s)[^)]*\)\s*$/, '').trim();
  const texte = sansPrecision || brut;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

const normaliser = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * « Ministre · Armées », « Premier ministre », « Garde des sceaux, ministre de
 * la justice » : la qualité, suivie du portefeuille sauf quand elle le nomme déjà.
 */
export function libellePoste(qualite: string, intituleCourt: string | null, intitule: string): string {
  const portefeuille = intituleAffiche(intituleCourt, intitule);
  return normaliser(qualite).includes(normaliser(portefeuille)) ? qualite : `${qualite} · ${portefeuille}`;
}

/** Les rangs protocolaires de la source, regroupés comme on présente un gouvernement. */
export const RANGS = [
  { titre: 'Premier ministre', rangs: [1] },
  { titre: 'Ministres d’État', rangs: [10] },
  { titre: 'Ministres', rangs: [20, 25, 30] },
  { titre: 'Ministres délégués', rangs: [40] },
  { titre: 'Secrétaires d’État', rangs: [50] },
] as const;

export function titreDuRang(rang: number): string {
  return RANGS.find((r) => (r.rangs as readonly number[]).includes(rang))?.titre ?? 'Autres membres';
}

/** « de » élidé devant une voyelle : « présidence d’Emmanuel Macron ». */
export function de(mot: string): string {
  return /^[aeiouyhàâéèêëîïôûü]/i.test(mot) ? `d’${mot}` : `de ${mot}`;
}

export function nomComplet(p: { prenom: string; nom: string }): string {
  return `${p.prenom} ${p.nom}`;
}

/** Ce qu'il faut pour trouver la page d'une personne : sa fiche, sinon son slug de membre. */
type AvecPage = { parlementaire?: PersonneGouvernement['parlementaire']; slug?: string | null };

export function lienFiche(p: AvecPage): string | null {
  if (!p.parlementaire) return null;
  return `/${p.parlementaire.chambre === 'senat' ? 'senateurs' : 'deputes'}/${p.parlementaire.slug}`;
}

/** La page d'une personne : sa fiche quand elle en a une, sinon sa page de membre du Gouvernement. */
export function lienPersonne(p: AvecPage): string | null {
  return lienFiche(p) ?? (p.slug ? `/gouvernements/membres/${p.slug}` : null);
}

/** Un membre du Gouvernement, fiche ou non (`/gouvernements/membres/:slug`). */
export interface MembreGouvernement extends PersonneGouvernement {
  slug: string;
  /** Absente d'une réponse mise en cache avant la page des membres. */
  dateNaissance?: string | null;
  /** Absent d'une réponse mise en cache avant la page des membres. */
  presidences?: Array<{ uid: string; dateDebut: string; dateFin: string | null }>;
  postes: Array<{
    uid: string;
    qualite: string;
    rangProtocolaire: number;
    intitule: string;
    intituleCourt: string | null;
    domaine: string | null;
    dateDebut: string;
    dateFin: string | null;
    gouvernement: { uid: string; slug: string; nom: string } | null;
    /** null : poste fini avant juin 2017. */
    bilan: BilanPoste | null;
  }>;
}

/**
 * Où ranger un membre dans le fil d'Ariane de sa page : sous sa fonction la
 * plus récente. Un ministre sous son dernier gouvernement ; un président de la
 * République sous la présidence (sa section de `/gouvernements`, qui regroupe
 * ses gouvernements). « Gouvernements / Philippe Baptiste » se lisait comme le
 * gouvernement de Philippe Baptiste, et Emmanuel Macron se retrouvait sous
 * « Gouvernement Valls II ».
 */
export function rattachementDuMembre(
  m: Pick<MembreGouvernement, 'postes' | 'presidences'>,
): { nom: string; href: string } | null {
  let poste: MembreGouvernement['postes'][number] | null = null;
  for (const p of m.postes) {
    if (p.gouvernement && (!poste || p.dateDebut > poste.dateDebut)) poste = p;
  }
  let presidence: NonNullable<MembreGouvernement['presidences']>[number] | null = null;
  for (const p of m.presidences ?? []) {
    if (!presidence || p.dateDebut > presidence.dateDebut) presidence = p;
  }
  if (presidence && (!poste || presidence.dateDebut > poste.dateDebut)) {
    return { nom: 'Présidence de la République', href: `/gouvernements#${presidence.uid}` };
  }
  return poste?.gouvernement
    ? { nom: `Gouvernement ${poste.gouvernement.nom}`, href: `/gouvernements/${poste.gouvernement.slug}` }
    : null;
}

/**
 * Les postes et présidences d'un membre, sous la forme des fonctions d'une
 * fiche : la page d'un membre sans fiche reprend la frise et ses regroupements
 * (`regrouperPostes`, `fonctionEnCours`).
 */
export function fonctionsDuMembre(m: MembreGouvernement): FonctionGouvernementale[] {
  const president = m.civilite === 'Mme' ? 'Présidente de la République' : 'Président de la République';
  return [
    ...(m.presidences ?? []).map(
      (p): FonctionGouvernementale => ({
        type: 'presidence',
        uid: p.uid,
        qualite: president,
        intitule: 'Présidence de la République',
        intituleCourt: null,
        rangProtocolaire: null,
        domaine: null,
        dateDebut: p.dateDebut,
        dateFin: p.dateFin,
        gouvernement: null,
        membreSlug: m.slug,
        bilan: null,
      }),
    ),
    ...m.postes.map(
      (p): FonctionGouvernementale => ({
        type: 'poste_ministeriel',
        uid: p.uid,
        qualite: p.qualite,
        intitule: p.intitule,
        intituleCourt: p.intituleCourt,
        rangProtocolaire: p.rangProtocolaire,
        domaine: p.domaine,
        dateDebut: p.dateDebut,
        dateFin: p.dateFin,
        gouvernement: p.gouvernement,
        membreSlug: m.slug,
        bilan: p.bilan,
      }),
    ),
  ];
}

// =============================================================================
// Lecture d'un gouvernement : durée, composition à une date, remaniements
// =============================================================================

/** La date du jour, civile, à Paris. */
export function aujourdhui(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/** « 2 ans et 3 mois », « 4 mois », « 27 jours » : la durée entre deux dates civiles. */
export function duree(debut: string, fin: string): string {
  const [a1, m1, j1] = debut.split('-').map(Number) as [number, number, number];
  const [a2, m2, j2] = fin.split('-').map(Number) as [number, number, number];
  let mois = (a2 - a1) * 12 + (m2 - m1) - (j2 < j1 ? 1 : 0);
  if (mois < 1) {
    const jours = Math.round((dateCivile(fin).getTime() - dateCivile(debut).getTime()) / 86_400_000);
    return `${jours} jour${jours > 1 ? 's' : ''}`;
  }
  const ans = Math.floor(mois / 12);
  mois -= ans * 12;
  const enAns = ans > 0 ? `${ans} an${ans > 1 ? 's' : ''}` : '';
  const enMois = mois > 0 ? `${mois} mois` : '';
  return [enAns, enMois].filter(Boolean).join(' et ');
}

/** Les postes tenus à une date : commencés ce jour-là ou avant, pas encore finis la veille. */
export function compositionAu(postes: readonly PosteMinisteriel[], jour: string): PosteMinisteriel[] {
  return postes.filter((p) => p.dateDebut <= jour && (p.dateFin === null || p.dateFin >= jour));
}

export interface Changement {
  date: string;
  entrees: PosteMinisteriel[];
  sorties: PosteMinisteriel[];
}

/**
 * Les changements de composition en cours de gouvernement, du plus ancien au
 * plus récent : un poste qui commence après la nomination, ou qui finit avant
 * la fin du gouvernement. Les fins au jour ou au lendemain de la fin (affaires
 * courantes) n'en sont pas.
 *
 * La nomination des membres n'en est pas un non plus. Le gouvernement commence
 * avec son Premier ministre, seul, et ses membres sont nommés de 1 à 26 jours
 * plus tard (Lecornu I : Premier ministre le 10 septembre 2025, membres le
 * 5 octobre). Quand le Premier ministre est seul au premier jour, la première
 * vague d'entrées, sans sortie, est donc la nomination.
 */
export function changements(
  g: { dateDebut: string; dateFin: string | null },
  postes: readonly PosteMinisteriel[],
): { nomination: Changement | null; changements: Changement[] } {
  const parDate = new Map<string, Changement>();
  const a = (date: string) => {
    let c = parDate.get(date);
    if (!c) parDate.set(date, (c = { date, entrees: [], sorties: [] }));
    return c;
  };
  for (const p of postes) {
    if (p.dateDebut > g.dateDebut) a(p.dateDebut).entrees.push(p);
    if (p.dateFin && (g.dateFin === null || p.dateFin < g.dateFin)) a(p.dateFin).sorties.push(p);
  }
  const tous = fusionnerLaVeille([...parDate.values()].sort((x, y) => x.date.localeCompare(y.date)));
  const premierMinistreSeul = postes.filter((p) => p.dateDebut === g.dateDebut).length <= 1;
  const premier = tous[0];
  if (premierMinistreSeul && premier && premier.entrees.length > 0 && premier.sorties.length === 0) {
    return { nomination: premier, changements: tous.slice(1) };
  }
  return { nomination: null, changements: tous };
}

function lendemain(jour: string): string {
  const d = dateCivile(jour);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * La source clôt l'ancien poste la veille du jour où le nouveau commence
 * (Maud Bregeon quitte son poste de ministre déléguée le 26 février 2026 et
 * devient ministre le 27) : une journée de sorties seules suivie d'entrées le
 * lendemain est un seul remaniement, daté du jour des entrées.
 */
function fusionnerLaVeille(liste: Changement[]): Changement[] {
  const resultat: Changement[] = [];
  for (let i = 0; i < liste.length; i++) {
    const c = liste[i]!;
    const suivant = liste[i + 1];
    if (c.entrees.length === 0 && suivant && suivant.entrees.length > 0 && suivant.date === lendemain(c.date)) {
      liste[i + 1] = { date: suivant.date, entrees: suivant.entrees, sorties: [...c.sorties, ...suivant.sorties] };
      continue;
    }
    resultat.push(c);
  }
  return resultat;
}

/** Les postes rangés par domaine, dans l'ordre des domaines ; ceux sans domaine à la fin. */
export function parDomaine(
  postes: readonly PosteMinisteriel[],
  domaines: readonly Domaine[],
): { domaine: Domaine; postes: PosteMinisteriel[] }[] {
  const ordre = (p: PosteMinisteriel, q: PosteMinisteriel) =>
    p.rangProtocolaire - q.rangProtocolaire || p.dateDebut.localeCompare(q.dateDebut) || p.uid.localeCompare(q.uid);
  const connus = new Set(domaines.map((d) => d.cle));
  const groupes = domaines
    .map((domaine) => ({ domaine, postes: postes.filter((p) => p.domaine === domaine.cle).sort(ordre) }))
    .filter((g) => g.postes.length > 0);
  const autres = postes.filter((p) => !p.domaine || !connus.has(p.domaine)).sort(ordre);
  if (autres.length > 0) groupes.push({ domaine: { cle: 'autres', libelle: 'Autres portefeuilles' }, postes: autres });
  return groupes;
}

/** « Mme Rachida Dati » → « RD » : l'avatar d'une personne sans photo. */
export function initiales(p: { prenom: string; nom: string }): string {
  return `${p.prenom.charAt(0)}${p.nom.charAt(0)}`.toUpperCase();
}

/**
 * La fonction gouvernementale ou présidentielle que la personne exerce
 * aujourd'hui, la plus haute s'il y en a plusieurs (un Premier ministre
 * chargé d'un ministère par intérim reste Premier ministre).
 *
 * C'est elle que la fiche met en avant : Sébastien Lecornu a été sénateur un
 * mois, sa fiche est au Sénat, mais le lecteur cherche le Premier ministre.
 */
export function fonctionEnCours(
  fonctions: readonly FonctionGouvernementale[] | null | undefined,
  sexe: string | null | undefined,
): { titre: string; dansUnTitre: string; depuis: string; gouvernement: FonctionGouvernementale['gouvernement'] } | null {
  const enCours = (fonctions ?? []).filter((f) => f.dateFin === null);
  if (enCours.length === 0) return null;
  const rang = (f: FonctionGouvernementale) =>
    f.type === 'presidence' ? 0 : /^premi(er|ère) ministre$/i.test(f.intituleCourt ?? f.intitule) ? 1 : 2;
  const f = [...enCours].sort((a, b) => rang(a) - rang(b) || b.dateDebut.localeCompare(a.dateDebut))[0]!;
  if (f.type === 'presidence') {
    const titre = sexe === 'F' ? 'Présidente de la République' : 'Président de la République';
    return { titre, dansUnTitre: titre.charAt(0).toLowerCase() + titre.slice(1), depuis: f.dateDebut, gouvernement: null };
  }
  if (rang(f) === 1) return { titre: f.qualite, dansUnTitre: f.qualite, depuis: f.dateDebut, gouvernement: f.gouvernement };
  const portefeuille = intituleAffiche(f.intituleCourt, f.intitule);
  return {
    titre: libellePoste(f.qualite, f.intituleCourt, f.intitule),
    dansUnTitre: `${f.qualite.charAt(0).toLowerCase()}${f.qualite.slice(1)} (${portefeuille})`,
    depuis: f.dateDebut,
    gouvernement: f.gouvernement,
  };
}

/** Une étape de la vie d'un gouvernement, et sa composition au soir de cette étape. */
export interface Etape {
  date: string;
  nature: 'nomination' | 'changement';
  /** Personnes qui entrent au gouvernement. */
  entrees: PosteMinisteriel[];
  /** Personnes déjà membres qui changent de poste : leur nouveau poste. */
  mutations: PosteMinisteriel[];
  /** Personnes qui quittent le gouvernement : leur dernier poste. */
  sorties: PosteMinisteriel[];
  composition: PosteMinisteriel[];
}

/**
 * La nomination, puis chaque changement de composition (cf. `changements`),
 * avec la composition qui en résulte. La composition d'une étape retire les
 * sorties du jour même : un poste qui finit à la date D est encore tenu ce
 * jour-là pour la source, mais il n'est plus de la composition qui suit.
 */
export function etapes(g: { dateDebut: string; dateFin: string | null }, postes: readonly PosteMinisteriel[]): Etape[] {
  const { nomination, changements: suite } = changements(g, postes);
  const premiere: Changement = nomination ?? {
    date: g.dateDebut,
    entrees: postes.filter((p) => p.dateDebut === g.dateDebut),
    sorties: [],
  };
  return [premiere, ...suite].map((c, i) => {
    const sortants = new Set(c.sorties.map((p) => p.uid));
    const personnesSortantes = new Set(c.sorties.map((p) => p.membre.acteurUid));
    const mutations = i === 0 ? [] : c.entrees.filter((p) => personnesSortantes.has(p.membre.acteurUid));
    const mutees = new Set(mutations.map((p) => p.membre.acteurUid));
    return {
      date: c.date,
      nature: i === 0 ? ('nomination' as const) : ('changement' as const),
      entrees: c.entrees.filter((p) => !mutees.has(p.membre.acteurUid)),
      mutations,
      sorties: c.sorties.filter((p) => !mutees.has(p.membre.acteurUid)),
      composition: compositionAu(postes, c.date).filter((p) => !sortants.has(p.uid)),
    };
  });
}
