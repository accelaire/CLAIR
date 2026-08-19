/**
 * Calculs des graphiques de la page sénatoriales, et registre des graphiques
 * partageables.
 *
 * Tout ce fichier est pur : il ne dépend ni de React, ni du DOM, ni du thème.
 * C'est ce qui permet aux trois rendus de partir des mêmes chiffres — la page
 * dans le navigateur, le HTML servi par le serveur, et l'image Open Graph
 * fabriquée par Satori, qui ne sait exécuter aucun de ces trois. Si le calcul
 * vivait dans les composants, l'image partagée finirait par ne plus dire la même
 * chose que la page qu'elle annonce.
 */

import type { Sortant, GroupeRepartition } from '@/app/senatoriales-2026/PageClient';

// --- Registre ----------------------------------------------------------------

/**
 * Un graphique partageable = une URL.
 *
 * Le découpage en routes n'est pas cosmétique : une image Open Graph ne reçoit
 * que les segments de chemin, jamais les paramètres de requête. Un graphique
 * choisi par `?graphique=carte` aurait donc partagé l'aperçu de la page mère,
 * quel que soit le graphique affiché. Le slug est dans le chemin pour que
 * l'aperçu du lien montre le graphique dont il est le lien.
 */
export const GRAPHIQUES = {
  carte: {
    titre: 'Où se joue le renouvellement',
    sousTitre:
      '178 sièges remis en jeu dans 64 départements. Les autres attendront 2029.',
    accroche: 'Sièges renouvelés par département',
    court: 'Départements',
  },
  groupes: {
    titre: 'Ce que chaque groupe remet en jeu',
    sousTitre:
      "La part de ses sièges que chaque groupe soumet au vote des grands électeurs.",
    accroche: 'Part des sièges remise en jeu, par groupe',
    court: 'Groupes',
  },
  presence: {
    titre: 'Présence et loyauté des sortants',
    sousTitre:
      'La quasi-totalité des sortants dépasse 95 % de présence. Une dizaine en est très loin.',
    accroche: 'Répartition des sortants par tranche de présence',
    court: 'Présence',
  },
  activite: {
    titre: 'Interventions et amendements',
    sousTitre:
      'Ramenés au mois de mandat, pour que les arrivées en cours de mandature restent comparables.',
    accroche: 'Activité mensuelle des sortants',
    court: 'Activité',
  },
  ages: {
    titre: 'L’âge des sortants',
    sousTitre: 'Âge au jour du scrutin, par tranche de cinq ans.',
    accroche: 'Pyramide des âges des sénateurs sortants',
    court: 'Âge',
  },
  commissions: {
    titre: 'Les sortants par commission',
    sousTitre:
      'Ce que le renouvellement retire à chaque commission permanente du Sénat.',
    accroche: 'Répartition des sortants par commission',
    court: 'Commissions',
  },
  professions: {
    titre: 'D’où viennent les sortants',
    sousTitre:
      'Catégorie socio-professionnelle déclarée au Sénat, regroupée par famille.',
    accroche: 'Origine professionnelle des sortants',
    court: 'Professions',
  },
} as const;

export type SlugGraphique = keyof typeof GRAPHIQUES;

/**
 * Tris acceptés pour la liste des sortants, dans l'ordre du sélecteur.
 *
 * Doit rester aligné sur l'énumération de l'API : une valeur absente là-bas fait
 * répondre 400, donc rendre une page vide.
 *
 * Défini ici et non dans `PageClient`, qui est un module `'use client'` : le
 * rendu serveur doit pouvoir valider le tri de l'URL avant de le transmettre à
 * l'API, et les exports d'un module client lui parviennent sous forme de proxys
 * dont il ne peut appeler aucune méthode.
 */
export const TRIS_SORTANTS = [
  'departement',
  'groupe',
  'commission',
  'profession',
  'nom',
  'age',
  'presence',
  'loyaute',
  'amendements',
  'interventions',
];

/** Filtres résolus par le rendu serveur et transmis au composant client. */
export interface FiltresSortants {
  departement?: string;
  groupe?: string;
  tri?: string;
}

/**
 * Le graphique qu'appelle chaque tri de la liste.
 *
 * La page n'affiche pas ses sept graphiques d'un bloc : elle en montre un, celui
 * qui éclaire le tri demandé. Trier par présence sans voir la distribution des
 * présences, c'est lire un classement sans savoir si l'écart entre le premier et
 * le dernier vaut quelque chose ; afficher les sept en permanence, c'est repousser
 * la liste des sortants à mille pixels sous la carte.
 *
 * `null` pour le tri par nom : un ordre alphabétique n'illustre rien.
 * `departement` renvoie à la carte, qui reste affichée en permanence au-dessus —
 * elle sert à sélectionner, pas seulement à décrire.
 */
export const GRAPHIQUE_PAR_TRI: Record<string, SlugGraphique | null> = {
  departement: 'carte',
  groupe: 'groupes',
  commission: 'commissions',
  profession: 'professions',
  age: 'ages',
  presence: 'presence',
  // Présence et loyauté partagent une page : elle porte les deux distributions,
  // qui se lisent l'une à côté de l'autre.
  loyaute: 'presence',
  amendements: 'activite',
  interventions: 'activite',
  nom: null,
};

/**
 * Les lectures possibles de la liste des sortants, dans l'ordre d'affichage.
 *
 * Chacune correspond à un tri et, sauf pour l'ordre alphabétique, au graphique
 * qui l'illustre. Présentées côte à côte plutôt que repliées dans un menu :
 * c'est la seule façon de faire comprendre que la page propose neuf angles sur
 * les mêmes données, et non un simple réordonnancement de cartes.
 */
export const LECTURES: { tri: string; label: string; aide: string }[] = [
  { tri: 'departement', label: 'Département', aide: 'Où se joue le renouvellement' },
  { tri: 'groupe', label: 'Groupe', aide: 'Ce que chaque groupe remet en jeu' },
  { tri: 'commission', label: 'Commission', aide: 'Ce que perd chaque commission' },
  { tri: 'profession', label: 'Profession', aide: 'D’où viennent les sortants' },
  { tri: 'age', label: 'Âge', aide: 'Pyramide des âges' },
  { tri: 'presence', label: 'Présence', aide: 'Répartition des taux de présence' },
  { tri: 'loyaute', label: 'Loyauté', aide: 'Répartition des taux de loyauté' },
  { tri: 'amendements', label: 'Amendements', aide: 'Activité mensuelle' },
  { tri: 'interventions', label: 'Interventions', aide: 'Activité mensuelle' },
  { tri: 'nom', label: 'Nom', aide: 'Ordre alphabétique' },
];

export const SLUGS_GRAPHIQUES = Object.keys(GRAPHIQUES) as SlugGraphique[];

export function estSlugGraphique(valeur: string): valeur is SlugGraphique {
  // `in` remonte la chaîne de prototypes : « toString », « constructor » ou
  // « __proto__ » passaient le garde-fou. La page rendait alors un 200 au titre
  // vide, avec sa propre URL en canonique et une image de partage blanche —
  // autant de pages molles offertes à l'indexation.
  return Object.prototype.hasOwnProperty.call(GRAPHIQUES, valeur);
}

// --- Palette -----------------------------------------------------------------

/**
 * Rampe séquentielle de la carte, du plus clair au plus soutenu.
 *
 * Choisie à teinte constante et luminosité décroissante : l'ordre des classes
 * reste lisible en niveaux de gris et pour un daltonisme rouge-vert, ce qu'une
 * rampe multicolore ne garantit pas.
 *
 * Le premier ton n'est volontairement pas le plus pâle de la gamme. La classe la
 * plus basse est aussi la plus fréquente — la moitié des départements de la
 * série n'ont qu'un ou deux sièges — et elle doit d'abord se distinguer du gris
 * des départements non concernés, qui la jouxte partout sur la carte. Un bleu
 * presque blanc rendait cette frontière, la seule qui compte vraiment ici,
 * illisible en thème clair.
 */
export const RAMPE_CARTE = ['#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'] as const;

/** Départements sans siège renouvelé : présents, mais en retrait. */
export const COULEUR_HORS_SERIE = '#e2e8f0';
export const COULEUR_HORS_SERIE_SOMBRE = '#1e293b';

/** Repli quand un groupe n'a pas de couleur en base. */
export const COULEUR_GROUPE_DEFAUT = '#94a3b8';

// --- Carte -------------------------------------------------------------------

export interface SiegesDepartement {
  /** Code INSEE : '01', '2A', '997'. */
  code: string;
  nom: string;
  sieges: number;
}

/**
 * Sièges renouvelés par département, tous départements confondus — métropole,
 * outre-mer et Français de l'étranger.
 */
export function siegesParDepartement(sortants: Sortant[]): SiegesDepartement[] {
  const parCode = new Map<string, SiegesDepartement>();
  for (const sortant of sortants) {
    const circo = sortant.circonscription;
    if (!circo) continue;
    const existant = parCode.get(circo.departement);
    if (existant) existant.sieges += 1;
    else parCode.set(circo.departement, { code: circo.departement, nom: circo.nom, sieges: 1 });
  }
  return Array.from(parCode.values()).sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Un code de circonscription se dessine-t-il sur la carte ?
 *
 * La table des contours ne couvre que les départements métropolitains. Les
 * collectivités d'outre-mer et les Français établis hors de France — treize
 * sièges de la série 2 — n'y sont pas et ne peuvent pas y être : les placer à
 * leur position réelle étirerait le cadrage sur un demi-globe. Ils sont
 * présentés à côté de la carte, en vignettes, pour ne pas disparaître du décompte.
 */
export function estMetropole(code: string): boolean {
  return code.length === 2;
}

/**
 * Classe d'une valeur dans la rampe.
 *
 * Les bornes sont fixées sur l'étendue observée plutôt que sur des seuils ronds :
 * la série 2 va de 1 à 8 sièges, un découpage en tranches figées laisserait des
 * classes vides et écraserait les écarts réels.
 */
export function classeCarte(sieges: number, maxSieges: number): number {
  if (sieges <= 0) return -1;
  if (maxSieges <= 1) return RAMPE_CARTE.length - 1;
  const position = (sieges - 1) / (maxSieges - 1);
  return Math.min(RAMPE_CARTE.length - 1, Math.floor(position * RAMPE_CARTE.length));
}

export function couleurCarte(sieges: number, maxSieges: number, sombre = false): string {
  const classe = classeCarte(sieges, maxSieges);
  if (classe < 0) return sombre ? COULEUR_HORS_SERIE_SOMBRE : COULEUR_HORS_SERIE;
  return RAMPE_CARTE[classe];
}

// --- Groupes : part remise en jeu --------------------------------------------

export interface PartGroupe extends GroupeRepartition {
  siegesSenat: number;
  /** Part des sièges du groupe soumise au scrutin, en pourcentage. */
  part: number;
}

/**
 * Répartition par groupe recalculée sur une sous-liste de sortants.
 *
 * Les graphiques de la page décrivent la sélection courante, pas l'ensemble du
 * renouvellement : filtrer sur la Gironde doit donner les groupes de la Gironde.
 * Mais le dénominateur, lui, ne se filtre pas — l'effectif d'un groupe au Sénat
 * est ce qu'il est, et le recompter sur la sélection donnerait une part remise en
 * jeu systématiquement égale à 100 %. Il est donc repris de l'aperçu global.
 */
export function repartitionParGroupe(
  sortants: Sortant[],
  reference: GroupeRepartition[],
): GroupeRepartition[] {
  const effectifsSenat = new Map(reference.map((g) => [g.slug, g.siegesSenat]));
  const parSlug = new Map<string, GroupeRepartition>();

  for (const sortant of sortants) {
    const slug = sortant.groupe?.slug ?? 'sans-groupe';
    const existant = parSlug.get(slug);
    if (existant) {
      existant.sieges += 1;
      continue;
    }
    parSlug.set(slug, {
      slug,
      nom: sortant.groupe?.nom ?? 'Sans groupe',
      nomComplet: sortant.groupe?.nomComplet ?? null,
      couleur: sortant.groupe?.couleur ?? null,
      position: sortant.groupe?.position ?? null,
      sieges: 1,
      siegesSenat: effectifsSenat.get(slug),
    });
  }

  return Array.from(parSlug.values());
}

/**
 * Part remise en jeu par groupe, du plus exposé au moins exposé.
 *
 * Le tri se fait sur la part et non sur le nombre de sièges : c'est justement
 * l'écart entre les deux lectures que le graphique existe pour montrer.
 */
export function partsRemisesEnJeu(parGroupe: GroupeRepartition[]): PartGroupe[] {
  return parGroupe
    .map((groupe) => {
      const siegesSenat = groupe.siegesSenat ?? groupe.sieges;
      return {
        ...groupe,
        siegesSenat,
        part: siegesSenat > 0 ? (groupe.sieges / siegesSenat) * 100 : 0,
      };
    })
    .sort((a, b) => b.part - a.part || b.sieges - a.sieges || a.nom.localeCompare(b.nom, 'fr'));
}

// --- Distributions -----------------------------------------------------------

export type MetriqueBilan = 'presence' | 'loyaute';

export interface PointDistribution {
  slug: string;
  nom: string;
  valeur: number;
  couleur: string;
  groupe: string;
}

/**
 * Les sortants qui portent une valeur mesurée pour la métrique demandée.
 *
 * Une statistique absente est écartée plutôt que ramenée à zéro : un sénateur
 * dont le bilan n'a pas encore été calculé apparaîtrait sinon comme le plus
 * absent de tous.
 */
export function pointsDistribution(
  sortants: Sortant[],
  metrique: MetriqueBilan,
): PointDistribution[] {
  return sortants
    .filter((s) => s.bilan[metrique] !== null)
    .map((s) => ({
      slug: s.personne.slug,
      nom: `${s.personne.prenom} ${s.personne.nom}`,
      valeur: s.bilan[metrique] as number,
      couleur: s.groupe?.couleur ?? COULEUR_GROUPE_DEFAUT,
      groupe: s.groupe?.nom ?? 'Sans groupe',
    }))
    .sort((a, b) => a.valeur - b.valeur);
}

/** Médiane d'une série déjà triée. */
export function mediane(valeursTriees: number[]): number | null {
  if (valeursTriees.length === 0) return null;
  const milieu = Math.floor(valeursTriees.length / 2);
  return valeursTriees.length % 2 === 1
    ? valeursTriees[milieu]
    : (valeursTriees[milieu - 1] + valeursTriees[milieu]) / 2;
}

export interface BandeBilan {
  label: string;
  min: number;
  /** Borne haute exclue, sauf pour la dernière bande. */
  max: number;
  effectif: number;
}

/**
 * Tranches de lecture des taux de présence et de loyauté.
 *
 * Elles sont volontairement inégales, et resserrées vers le haut. Ces deux taux
 * sont extrêmement concentrés : 155 sortants sur 177 dépassent 95 % de présence,
 * 159 sur 177 pour la loyauté. Sur un axe régulier, tout se tasse contre le bord
 * droit en une colonne unique, et l'œil n'y distingue plus rien — ni la masse,
 * ni la petite dizaine de sortants qui en sont très loin. Des tranches larges en
 * bas et fines en haut redonnent leur place aux deux.
 *
 * Le libellé porte les bornes : sans lui, des barres de largeurs inégales
 * laisseraient croire à une échelle continue.
 */
export const BANDES_BILAN: { min: number; max: number; label: string }[] = [
  { min: 0, max: 50, label: 'moins de 50 %' },
  { min: 50, max: 70, label: '50 à 70 %' },
  { min: 70, max: 80, label: '70 à 80 %' },
  { min: 80, max: 90, label: '80 à 90 %' },
  { min: 90, max: 95, label: '90 à 95 %' },
  { min: 95, max: 99, label: '95 à 99 %' },
  { min: 99, max: 100, label: '99 % et plus' },
];

/** Effectif de chaque tranche, tranches vides comprises. */
export function bandesBilan(sortants: Sortant[], metrique: MetriqueBilan): BandeBilan[] {
  const valeurs = sortants
    .map((s) => s.bilan[metrique])
    .filter((v): v is number => v !== null);

  return BANDES_BILAN.map((bande) => ({
    ...bande,
    effectif: valeurs.filter((v) =>
      // La dernière tranche inclut sa borne haute, sinon les sortants à 100 %
      // — les plus nombreux — ne seraient comptés nulle part.
      bande.max === 100 ? v >= bande.min : v >= bande.min && v < bande.max,
    ).length,
  }));
}

/**
 * Les sortants les plus bas sur la métrique.
 *
 * C'est la partie que la masse écrase et qui a le plus de valeur : dire que la
 * médiane est à 98 % n'apprend rien, nommer ceux qui sont à 7 % si.
 */
export function extremesBilan(
  sortants: Sortant[],
  metrique: MetriqueBilan,
  combien = 5,
): PointDistribution[] {
  return pointsDistribution(sortants, metrique).slice(0, combien);
}

// --- Activité ----------------------------------------------------------------

export interface PointActivite {
  /** Identifiant du mandat, clé de la surbrillance dans la liste. */
  mandatId: string;
  slug: string;
  nom: string;
  /** Interventions par mois de mandat. */
  interventions: number;
  /** Amendements par mois de mandat. */
  amendements: number;
  couleur: string;
  groupe: string;
}

/**
 * Activité ramenée au mois de mandat.
 *
 * Les compteurs bruts ne sont pas comparables entre eux : un sénateur arrivé en
 * cours de mandature a eu moins d'occasions de siéger, et le nuage brut ne
 * mesurerait alors que la date d'arrivée. La division par la durée réellement
 * couverte est ce qui rend les deux axes comparables.
 */
export function pointsActivite(sortants: Sortant[]): PointActivite[] {
  return sortants
    .filter(
      (s) =>
        s.mandat.dureeMois > 0 &&
        (s.bilan.interventions !== null || s.bilan.amendements !== null),
    )
    .map((s) => ({
      mandatId: s.mandatId,
      slug: s.personne.slug,
      nom: `${s.personne.prenom} ${s.personne.nom}`,
      interventions: (s.bilan.interventions ?? 0) / s.mandat.dureeMois,
      amendements: (s.bilan.amendements ?? 0) / s.mandat.dureeMois,
      couleur: s.groupe?.couleur ?? COULEUR_GROUPE_DEFAUT,
      groupe: s.groupe?.nom ?? 'Sans groupe',
    }));
}

// --- Pyramide des âges -------------------------------------------------------

export interface TrancheAge {
  /** Borne basse de la tranche, en années. */
  debut: number;
  label: string;
  hommes: number;
  femmes: number;
  /** Sortants dont le sexe n'est pas renseigné. */
  autres: number;
}

/** Âge révolu à une date donnée. */
export function ageA(dateNaissance: string, reference: Date): number {
  const naissance = new Date(dateNaissance);
  let age = reference.getUTCFullYear() - naissance.getUTCFullYear();
  const moisEcoules = reference.getUTCMonth() - naissance.getUTCMonth();
  if (moisEcoules < 0 || (moisEcoules === 0 && reference.getUTCDate() < naissance.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Exporté : l'affichage refait le découpage pour savoir qui se cache derrière
 * une barre cliquée. Recopié en dur là-bas, changer le pas ici regroupait les
 * barres sans changer la sélection — les mauvais sortants surlignés, sans la
 * moindre erreur de type pour le signaler.
 */
export const PAS_TRANCHE = 5;

/**
 * Pyramide des âges au jour du scrutin, par tranches de cinq ans.
 *
 * L'âge est pris à la date du scrutin et non à aujourd'hui : c'est l'âge au
 * moment où le siège est remis en jeu qui a un sens ici, et il ne bougera plus
 * — la page dirait sinon des chiffres différents d'un mois sur l'autre.
 */
export function pyramideAges(sortants: Sortant[], scrutin: Date): TrancheAge[] {
  const parTranche = new Map<number, TrancheAge>();
  for (const sortant of sortants) {
    if (!sortant.personne.dateNaissance) continue;
    const age = ageA(sortant.personne.dateNaissance, scrutin);
    // Une date illisible donne un âge NaN, qui devient une tranche NaN : le
    // `Math.min` plus bas vaut alors NaN à son tour et la boucle de complétion
    // ne s'exécute jamais. Une seule date abîmée effaçait toute la pyramide,
    // page et image de partage comprises.
    if (!Number.isFinite(age)) continue;
    const debut = Math.floor(age / PAS_TRANCHE) * PAS_TRANCHE;
    let tranche = parTranche.get(debut);
    if (!tranche) {
      tranche = {
        debut,
        label: `${debut}–${debut + PAS_TRANCHE - 1}`,
        hommes: 0,
        femmes: 0,
        autres: 0,
      };
      parTranche.set(debut, tranche);
    }
    if (sortant.personne.sexe === 'M') tranche.hommes += 1;
    else if (sortant.personne.sexe === 'F') tranche.femmes += 1;
    else tranche.autres += 1;
  }

  // Les tranches vides intercalées sont conservées : une pyramide trouée est une
  // information, une pyramide recompactée est un mensonge sur la continuité.
  const tranches = Array.from(parTranche.values());
  if (tranches.length === 0) return [];
  const min = Math.min(...tranches.map((t) => t.debut));
  const max = Math.max(...tranches.map((t) => t.debut));
  const completes: TrancheAge[] = [];
  for (let debut = min; debut <= max; debut += PAS_TRANCHE) {
    completes.push(
      parTranche.get(debut) ?? {
        debut,
        label: `${debut}–${debut + PAS_TRANCHE - 1}`,
        hommes: 0,
        femmes: 0,
        autres: 0,
      },
    );
  }
  return completes.reverse();
}

// --- Comptages simples -------------------------------------------------------

export interface Comptage {
  label: string;
  valeur: number;
}

/**
 * Libellés de repli des regroupements.
 *
 * Exportés parce que la barre du graphique, la section de la liste et l'index
 * qui relie les deux doivent porter exactement la même chaîne. Écrits trois
 * fois, ils divergeaient : on cliquait « Non renseignée » pour atterrir sur une
 * section intitulée « Sans commission permanente ».
 */
export const SANS_COMMISSION = 'Sans commission permanente';
export const SANS_PROFESSION = 'Profession non renseignée';

/** Sortants par commission permanente, de la plus touchée à la moins touchée. */
export function parCommission(sortants: Sortant[]): Comptage[] {
  return compter(sortants.map((s) => s.commissionPermanente ?? SANS_COMMISSION));
}

/**
 * Famille d'une catégorie professionnelle : la part qui précède la parenthèse.
 *
 * Le Sénat publie une catégorie détaillée du type « Salariés (Cadres divers) ».
 * Prises telles quelles, ces catégories font une vingtaine de sections d'un ou
 * deux sortants, qui ne regroupent plus rien.
 *
 * Le même découpage est appliqué côté API pour le tri par profession : deux
 * règles différentes donneraient des sections que le graphique ne décrirait plus.
 */
export function familleProfession(profession: string | null): string | null {
  const valeur = profession?.trim();
  if (!valeur) return null;
  const [famille] = valeur.split(' (');
  return famille ? famille.trim() : valeur;
}

/** Sortants par famille professionnelle. */
export function parFamilleProfession(sortants: Sortant[]): Comptage[] {
  return compter(
    sortants.map((s) => familleProfession(s.personne.profession) ?? SANS_PROFESSION),
  );
}

function compter(valeurs: string[]): Comptage[] {
  const parLabel = new Map<string, number>();
  for (const valeur of valeurs) {
    parLabel.set(valeur, (parLabel.get(valeur) ?? 0) + 1);
  }
  return Array.from(parLabel.entries())
    .map(([label, valeur]) => ({ label, valeur }))
    // Le départage par libellé rend l'ordre stable entre deux rendus : sans lui,
    // deux catégories à égalité s'échangent d'un appel à l'autre.
    .sort((a, b) => b.valeur - a.valeur || a.label.localeCompare(b.label, 'fr'));
}
