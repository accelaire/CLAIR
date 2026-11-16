import type {
  DomaineMinisteriel,
  FonctionGouvernementale,
  NatureProjet,
  PersonneGouvernement,
  PosteMinisteriel,
  StadeProjet,
} from "@clair/data";
import { parlementaireHref } from "../scrutins.ts";

/**
 * Règles d'affichage des gouvernements, postes ministériels et présidences (reprise de
 * `apps/web/lib/gouvernements.ts`, master 4cb005d et suivants). Les dates sont des dates civiles
 * de la source (`YYYY-MM-DD`), lues à midi UTC pour ne jamais changer de jour avec le fuseau.
 */

export const LIBELLES_STADE: Record<StadeProjet, string> = {
  promulgue: "promulgué",
  adopte: "adopté, pas encore promulgué",
  examine: "examiné, sans adoption définitive",
  depose: "déposé, jamais examiné en séance",
};

export const LIBELLES_NATURE: Record<NatureProjet, string> = {
  ordinaire: "projet de loi",
  ratification_ordonnance: "ratification d’ordonnance",
  convention: "convention internationale",
  finances: "loi de finances ou de financement de la sécurité sociale",
  constitutionnelle: "révision constitutionnelle",
  organique: "loi organique",
};

/** Pluriel simple : « 1 texte », « 3 textes ». */
export const nombre = (n: number, singulier: string, pluriel = `${singulier}s`): string =>
  `${n.toLocaleString("fr-FR")} ${n > 1 ? pluriel : singulier}`;

/** Une date civile de la source, à midi UTC. */
const dateCivile = (jour: string): Date => new Date(`${jour.slice(0, 10)}T12:00:00Z`);

/** « 27 février 2026 ». */
export const dateLongue = (jour: string): string =>
  dateCivile(jour).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** « 27 févr. 2026 » : assez court pour une frise. */
export const dateCourte = (jour: string): string =>
  dateCivile(jour).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** « févr. 2026 ». */
export const moisAnnee = (jour: string): string =>
  dateCivile(jour).toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * L'intitulé court d'un portefeuille, sans les précisions que l'AN ajoute pour distinguer deux
 * organes de même nom (« Fonction publique (II) », « Justice (garde des sceaux) »). Une parenthèse
 * qui complète le titre (« affaires étrangères (et européennes) ») est gardée.
 */
export const intituleAffiche = (intituleCourt: string | null, intitule: string): string => {
  const brut = intituleCourt ?? intitule;
  const sansPrecision = brut.replace(/\s*\((?!et\s)[^)]*\)\s*$/, "").trim();
  const texte = sansPrecision || brut;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

const normaliser = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * « Ministre · Armées », « Premier ministre » : la qualité, suivie du portefeuille sauf quand
 * elle le nomme déjà.
 */
export const libellePoste = (
  qualite: string,
  intituleCourt: string | null,
  intitule: string,
): string => {
  const portefeuille = intituleAffiche(intituleCourt, intitule);
  return normaliser(qualite).includes(normaliser(portefeuille))
    ? qualite
    : `${qualite} · ${portefeuille}`;
};

/** Les rangs protocolaires de la source, regroupés comme on présente un gouvernement. */
export const RANGS: readonly { titre: string; rangs: readonly number[] }[] = [
  { titre: "Premier ministre", rangs: [1] },
  { titre: "Ministres d’État", rangs: [10] },
  { titre: "Ministres", rangs: [20, 25, 30] },
  { titre: "Ministres délégués", rangs: [40] },
  { titre: "Secrétaires d’État", rangs: [50] },
];

export const titreDuRang = (rang: number): string =>
  RANGS.find((r) => r.rangs.includes(rang))?.titre ?? "Autres membres";

/** « de » élidé devant une voyelle : « présidence d’Emmanuel Macron ». */
export const de = (mot: string): string =>
  /^[aeiouyhàâéèêëîïôûü]/i.test(mot) ? `d’${mot}` : `de ${mot}`;

export const nomPersonne = (p: { prenom: string; nom: string }): string => `${p.prenom} ${p.nom}`;

/** Fiche CLAIR d'un membre, quand il en a une. */
export const lienFiche = (p: PersonneGouvernement): string | null =>
  p.parlementaire ? parlementaireHref(p.parlementaire.chambre, p.parlementaire.slug) : null;

/** « Premier ministre » ou « Première ministre », selon la civilité publiée. */
export const qualitePremierMinistre = (p: PersonneGouvernement): string =>
  p.civilite === "Mme" ? "Première ministre" : "Premier ministre";

/** « Mme Rachida Dati » → « RD » : l'avatar d'une personne sans photo. */
export const initiales = (p: { prenom: string; nom: string }): string =>
  `${p.prenom.charAt(0)}${p.nom.charAt(0)}`.toUpperCase();

/** La date civile du jour à Paris, pour un instant donné (ms). */
export const jourAParis = (instant: number): string =>
  new Date(instant).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

/** Nombre de jours entre deux dates civiles (au moins 1). */
export const joursEntre = (debut: string, fin: string): number =>
  Math.max(1, Math.round((dateCivile(fin).getTime() - dateCivile(debut).getTime()) / 86_400_000));

/** « 2 ans et 3 mois », « 4 mois », « 27 jours » : la durée entre deux dates civiles. */
export const duree = (debut: string, fin: string): string => {
  const [a1 = 0, m1 = 0, j1 = 0] = debut.slice(0, 10).split("-").map(Number);
  const [a2 = 0, m2 = 0, j2 = 0] = fin.slice(0, 10).split("-").map(Number);
  let mois = (a2 - a1) * 12 + (m2 - m1) - (j2 < j1 ? 1 : 0);
  if (mois < 1) {
    const jours = Math.round(
      (dateCivile(fin).getTime() - dateCivile(debut).getTime()) / 86_400_000,
    );
    return `${jours} jour${jours > 1 ? "s" : ""}`;
  }
  const ans = Math.floor(mois / 12);
  mois -= ans * 12;
  const enAns = ans > 0 ? `${ans} an${ans > 1 ? "s" : ""}` : "";
  const enMois = mois > 0 ? `${mois} mois` : "";
  return [enAns, enMois].filter(Boolean).join(" et ");
};

/** Les postes tenus à une date : commencés ce jour-là ou avant, pas encore finis la veille. */
export const compositionAu = (
  postes: readonly PosteMinisteriel[],
  jour: string,
): PosteMinisteriel[] =>
  postes.filter((p) => p.dateDebut <= jour && (p.dateFin === null || p.dateFin >= jour));

export type Changement = {
  date: string;
  entrees: PosteMinisteriel[];
  sorties: PosteMinisteriel[];
};

const lendemain = (jour: string): string => {
  const d = dateCivile(jour);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * La source clôt l'ancien poste la veille du jour où le nouveau commence : une journée de
 * sorties seules suivie d'entrées le lendemain est un seul remaniement, daté du jour des entrées.
 */
const fusionnerLaVeille = (liste: Changement[]): Changement[] => {
  const copie = [...liste];
  const resultat: Changement[] = [];
  copie.forEach((c, i) => {
    const suivant = copie[i + 1];
    if (
      c.entrees.length === 0 &&
      suivant &&
      suivant.entrees.length > 0 &&
      suivant.date === lendemain(c.date)
    ) {
      copie[i + 1] = {
        date: suivant.date,
        entrees: suivant.entrees,
        sorties: [...c.sorties, ...suivant.sorties],
      };
      return;
    }
    resultat.push(c);
  });
  return resultat;
};

/**
 * Les changements de composition en cours de gouvernement, du plus ancien au plus récent : un
 * poste qui commence après la nomination, ou qui finit avant la fin du gouvernement.
 *
 * La nomination des membres n'en est pas un : le gouvernement commence avec son Premier
 * ministre seul, et ses membres sont nommés quelques jours plus tard. Quand le Premier ministre
 * est seul au premier jour, la première vague d'entrées, sans sortie, est la nomination.
 */
export const changements = (
  g: { dateDebut: string; dateFin: string | null },
  postes: readonly PosteMinisteriel[],
): { nomination: Changement | null; changements: Changement[] } => {
  const parDate = new Map<string, Changement>();
  const a = (date: string): Changement => {
    const existant = parDate.get(date);
    if (existant) return existant;
    const nouveau: Changement = { date, entrees: [], sorties: [] };
    parDate.set(date, nouveau);
    return nouveau;
  };
  for (const p of postes) {
    if (p.dateDebut > g.dateDebut) a(p.dateDebut).entrees.push(p);
    if (p.dateFin && (g.dateFin === null || p.dateFin < g.dateFin)) a(p.dateFin).sorties.push(p);
  }
  const tous = fusionnerLaVeille(
    [...parDate.values()].sort((x, y) => x.date.localeCompare(y.date)),
  );
  const premierMinistreSeul = postes.filter((p) => p.dateDebut === g.dateDebut).length <= 1;
  const premier = tous[0];
  if (
    premierMinistreSeul &&
    premier &&
    premier.entrees.length > 0 &&
    premier.sorties.length === 0
  ) {
    return { nomination: premier, changements: tous.slice(1) };
  }
  return { nomination: null, changements: tous };
};

/** Une étape de la vie d'un gouvernement, et sa composition au soir de cette étape. */
export type Etape = {
  date: string;
  nature: "nomination" | "changement";
  /** Personnes qui entrent au gouvernement. */
  entrees: PosteMinisteriel[];
  /** Personnes déjà membres qui changent de poste : leur nouveau poste. */
  mutations: PosteMinisteriel[];
  /** Personnes qui quittent le gouvernement : leur dernier poste. */
  sorties: PosteMinisteriel[];
  composition: PosteMinisteriel[];
};

/**
 * La nomination, puis chaque changement de composition, avec la composition qui en résulte. Un
 * poste qui finit à la date D est encore tenu ce jour-là pour la source, mais il n'est plus de la
 * composition qui suit.
 */
export const etapes = (
  g: { dateDebut: string; dateFin: string | null },
  postes: readonly PosteMinisteriel[],
): Etape[] => {
  const { nomination, changements: suite } = changements(g, postes);
  const premiere: Changement = nomination ?? {
    date: g.dateDebut,
    entrees: postes.filter((p) => p.dateDebut === g.dateDebut),
    sorties: [],
  };
  return [premiere, ...suite].map((c, i) => {
    const sortants = new Set(c.sorties.map((p) => p.uid));
    const personnesSortantes = new Set(c.sorties.map((p) => p.membre.acteurUid));
    const mutations =
      i === 0 ? [] : c.entrees.filter((p) => personnesSortantes.has(p.membre.acteurUid));
    const mutees = new Set(mutations.map((p) => p.membre.acteurUid));
    return {
      date: c.date,
      nature: i === 0 ? "nomination" : "changement",
      entrees: c.entrees.filter((p) => !mutees.has(p.membre.acteurUid)),
      mutations,
      sorties: c.sorties.filter((p) => !mutees.has(p.membre.acteurUid)),
      composition: compositionAu(postes, c.date).filter((p) => !sortants.has(p.uid)),
    };
  });
};

/** Un remaniement nomme plusieurs personnes ; un départ ou un changement isolé n'en est pas un. */
export const natureEtape = (e: Etape): string => {
  if (e.nature === "nomination") return "Nomination";
  if (e.entrees.length + e.mutations.length >= 3) return "Remaniement";
  if (e.entrees.length === 0 && e.mutations.length === 0) {
    return e.sorties.length > 1 ? "Départs" : "Départ";
  }
  return "Changement";
};

/** Les postes rangés par domaine, dans l'ordre des domaines ; ceux sans domaine à la fin. */
export const parDomaine = (
  postes: readonly PosteMinisteriel[],
  domaines: readonly DomaineMinisteriel[],
): { domaine: DomaineMinisteriel; postes: PosteMinisteriel[] }[] => {
  const ordre = (p: PosteMinisteriel, q: PosteMinisteriel) =>
    p.rangProtocolaire - q.rangProtocolaire ||
    p.dateDebut.localeCompare(q.dateDebut) ||
    p.uid.localeCompare(q.uid);
  const connus = new Set(domaines.map((d) => d.cle));
  const groupes = domaines
    .map((domaine) => ({
      domaine,
      postes: postes.filter((p) => p.domaine === domaine.cle).sort(ordre),
    }))
    .filter((g) => g.postes.length > 0);
  const autres = postes.filter((p) => !p.domaine || !connus.has(p.domaine)).sort(ordre);
  if (autres.length > 0) {
    groupes.push({ domaine: { cle: "autres", libelle: "Autres portefeuilles" }, postes: autres });
  }
  return groupes;
};

/** La fonction gouvernementale en cours, telle que la fiche d'un parlementaire la présente. */
export type FonctionEnCoursGouvernement = {
  /** « Premier ministre », « Ministre · Armées », « Président de la République ». */
  titre: string;
  /** Le même, pour s'insérer dans un `<title>` : « ministre (Armées) ». */
  dansUnTitre: string;
  depuis: string;
  gouvernement: FonctionGouvernementale["gouvernement"];
};

const PREMIER_MINISTRE = /^premi(er|ère) ministre$/i;

/**
 * La fonction gouvernementale ou présidentielle exercée aujourd'hui, la plus haute s'il y en a
 * plusieurs (un Premier ministre chargé d'un ministère par intérim reste Premier ministre). C'est
 * elle que la fiche met en avant : le lecteur qui cherche le Premier ministre doit le reconnaître.
 */
export const fonctionEnCours = (
  fonctions: readonly FonctionGouvernementale[] | null | undefined,
  sexe: string | null | undefined,
): FonctionEnCoursGouvernement | null => {
  const enCours = (fonctions ?? []).filter((f) => f.dateFin === null);
  const rang = (f: FonctionGouvernementale) =>
    f.type === "presidence" ? 0 : PREMIER_MINISTRE.test(f.intituleCourt ?? f.intitule) ? 1 : 2;
  const [f] = [...enCours].sort(
    (a, b) => rang(a) - rang(b) || b.dateDebut.localeCompare(a.dateDebut),
  );
  if (!f) return null;
  if (f.type === "presidence") {
    const titre = sexe === "F" ? "Présidente de la République" : "Président de la République";
    return {
      titre,
      dansUnTitre: titre.charAt(0).toLowerCase() + titre.slice(1),
      depuis: f.dateDebut,
      gouvernement: null,
    };
  }
  if (rang(f) === 1) {
    return {
      titre: f.qualite,
      dansUnTitre: f.qualite,
      depuis: f.dateDebut,
      gouvernement: f.gouvernement,
    };
  }
  const portefeuille = intituleAffiche(f.intituleCourt, f.intitule);
  return {
    titre: libellePoste(f.qualite, f.intituleCourt, f.intitule),
    dansUnTitre: `${f.qualite.charAt(0).toLowerCase()}${f.qualite.slice(1)} (${portefeuille})`,
    depuis: f.dateDebut,
    gouvernement: f.gouvernement,
  };
};
