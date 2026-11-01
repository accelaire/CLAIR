// Gouvernements, postes ministériels et présidences : types de l'API
// (`/api/v1/gouvernements`) et règles d'affichage. Les dates sont des dates
// civiles de la source (`YYYY-MM-DD`), sans heure ni fuseau.

export interface PersonneGouvernement {
  acteurUid: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  /** Fiche CLAIR de la personne, quand elle en a une. Sinon, son nom seul. */
  parlementaire: { slug: string; chambre: string; photoUrl: string | null } | null;
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
  presidence: { uid: string; civilite: string | null; prenom: string; nom: string } | null;
  nbPostes: number;
  nbMembres: number;
  /** Membres dont la civilité publiée est « Mme ». */
  nbFemmes: number;
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

export interface GouvernementDetail extends GouvernementResume {
  precedent: { slug: string; nom: string } | null;
  suivant: { slug: string; nom: string } | null;
  postes: PosteMinisteriel[];
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
  dateDebut: string;
  dateFin: string | null;
  gouvernement: { uid: string; slug: string; nom: string } | null;
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

export function lienFiche(p: PersonneGouvernement): string | null {
  if (!p.parlementaire) return null;
  return `/${p.parlementaire.chambre === 'senat' ? 'senateurs' : 'deputes'}/${p.parlementaire.slug}`;
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
