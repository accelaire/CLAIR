/**
 * Correspondance entre le segment d'URL d'une circonscription et son code INSEE.
 *
 * L'API désigne une circonscription par son code (`circonscription.departement`,
 * « 33 », « 2A », « 997 »). C'est la bonne clé pour interroger la base, et une
 * mauvaise pour une URL : `/senatoriales-2026/33` ne dit rien à un lecteur, et
 * rien non plus à un moteur de recherche, alors que `/senatoriales-2026/gironde`
 * porte le mot que les gens tapent réellement.
 *
 * Cette table ne duplique donc pas la donnée : elle n'ajoute que le slug, qui
 * est une décision de présentation dont l'API n'a pas à connaître l'existence.
 * Tout le reste — nom d'affichage, nombre de sièges, liste des sortants —
 * continue de venir de `/senatoriales/2026`.
 *
 * Elle est figée, comme les dates de `SENATORIALES_2026` : la série 2 est fixée
 * par décret de convocation, ses 64 circonscriptions ne bougeront plus d'ici le
 * scrutin. Un slug qui changerait après indexation coûterait la position acquise
 * — c'est exactement ce qu'on cherche à construire ici.
 *
 * Troisième colonne : la locution de lieu, préposition comprise. Elle est écrite
 * en toutes lettres parce qu'aucune règle ne la dérive du nom — on dit « dans
 * l'Ain » mais « en Gironde », « dans le Rhône » mais « dans les Vosges », et
 * les circonscriptions d'outre-mer et des Français de l'étranger ne suivent
 * même pas ce système (« à Saint-Martin », « pour les Français établis hors de
 * France »). Une heuristique sur le genre ou l'initiale se trompe sur une
 * dizaine de cas, et ces mots sont dans le titre de niveau 1 de chaque page.
 */
const CIRCONSCRIPTIONS: ReadonlyArray<
  readonly [slug: string, code: string, locution: string]
> = [
  ['ain', '01', 'dans l’Ain'],
  ['aisne', '02', 'dans l’Aisne'],
  ['allier', '03', 'dans l’Allier'],
  ['alpes-de-haute-provence', '04', 'dans les Alpes de Haute-Provence'],
  ['hautes-alpes', '05', 'dans les Hautes-Alpes'],
  ['alpes-maritimes', '06', 'dans les Alpes-Maritimes'],
  ['ardeche', '07', 'en Ardèche'],
  ['ardennes', '08', 'dans les Ardennes'],
  ['ariege', '09', 'en Ariège'],
  ['aube', '10', 'dans l’Aube'],
  ['aude', '11', 'dans l’Aude'],
  ['aveyron', '12', 'dans l’Aveyron'],
  ['bouches-du-rhone', '13', 'dans les Bouches-du-Rhône'],
  ['calvados', '14', 'dans le Calvados'],
  ['cantal', '15', 'dans le Cantal'],
  ['charente', '16', 'en Charente'],
  ['charente-maritime', '17', 'en Charente-Maritime'],
  ['cher', '18', 'dans le Cher'],
  ['correze', '19', 'en Corrèze'],
  ['cote-d-or', '21', 'en Côte-d’Or'],
  ['cotes-d-armor', '22', 'dans les Côtes-d’Armor'],
  ['creuse', '23', 'dans la Creuse'],
  ['dordogne', '24', 'en Dordogne'],
  ['doubs', '25', 'dans le Doubs'],
  ['drome', '26', 'dans la Drôme'],
  ['eure', '27', 'dans l’Eure'],
  ['eure-et-loir', '28', 'en Eure-et-Loir'],
  ['finistere', '29', 'dans le Finistère'],
  ['corse-du-sud', '2A', 'en Corse-du-Sud'],
  ['haute-corse', '2B', 'en Haute-Corse'],
  ['gard', '30', 'dans le Gard'],
  ['haute-garonne', '31', 'en Haute-Garonne'],
  ['gers', '32', 'dans le Gers'],
  ['gironde', '33', 'en Gironde'],
  ['herault', '34', 'dans l’Hérault'],
  ['ille-et-vilaine', '35', 'en Ille-et-Vilaine'],
  ['indre', '36', 'dans l’Indre'],
  ['bas-rhin', '67', 'dans le Bas-Rhin'],
  ['haut-rhin', '68', 'dans le Haut-Rhin'],
  ['rhone', '69', 'dans le Rhône'],
  ['haute-saone', '70', 'en Haute-Saône'],
  ['saone-et-loire', '71', 'en Saône-et-Loire'],
  ['sarthe', '72', 'dans la Sarthe'],
  ['savoie', '73', 'en Savoie'],
  ['haute-savoie', '74', 'en Haute-Savoie'],
  ['seine-maritime', '76', 'en Seine-Maritime'],
  ['deux-sevres', '79', 'dans les Deux-Sèvres'],
  ['somme', '80', 'dans la Somme'],
  ['tarn', '81', 'dans le Tarn'],
  ['tarn-et-garonne', '82', 'dans le Tarn-et-Garonne'],
  ['var', '83', 'dans le Var'],
  ['vaucluse', '84', 'dans le Vaucluse'],
  ['vendee', '85', 'en Vendée'],
  ['vienne', '86', 'dans la Vienne'],
  ['haute-vienne', '87', 'en Haute-Vienne'],
  ['vosges', '88', 'dans les Vosges'],
  ['yonne', '89', 'dans l’Yonne'],
  ['territoire-de-belfort', '90', 'dans le Territoire de Belfort'],
  ['guyane', '973', 'en Guyane'],
  ['saint-barthelemy', '977', 'à Saint-Barthélemy'],
  ['saint-martin', '978', 'à Saint-Martin'],
  ['iles-wallis-et-futuna', '986', 'à Wallis-et-Futuna'],
  ['polynesie-francaise', '987', 'en Polynésie française'],
  ['francais-etablis-hors-de-france', '997', 'pour les Français établis hors de France'],
] as const;

/** Slugs des 64 circonscriptions de la série 2, dans l'ordre des codes INSEE. */
export const SLUGS_DEPARTEMENTS: readonly string[] = CIRCONSCRIPTIONS.map(([slug]) => slug);

const CODE_PAR_SLUG = new Map(CIRCONSCRIPTIONS.map(([slug, code]) => [slug, code]));
const SLUG_PAR_CODE = new Map(CIRCONSCRIPTIONS.map(([slug, code]) => [code, slug]));
const LOCUTION_PAR_CODE = new Map(
  CIRCONSCRIPTIONS.map(([, code, locution]) => [code, locution]),
);

/**
 * Code INSEE correspondant à un segment d'URL, ou `undefined` s'il n'en désigne
 * aucun.
 *
 * Le `undefined` est ce qui déclenche le `notFound()` de la page. Il vaut mieux
 * qu'un code inventé : la route est pré-rendue pour les 64 valeurs connues, mais
 * elle reste atteignable avec n'importe quel segment, et un slug fantaisiste ne
 * doit pas produire une page vide indexable.
 */
export function codeDepuisSlug(slug: string): string | undefined {
  return CODE_PAR_SLUG.get(slug);
}

/** Segment d'URL d'une circonscription, à partir de son code INSEE. */
export function slugDepuisCode(code: string): string | undefined {
  return SLUG_PAR_CODE.get(code);
}

/**
 * Locution de lieu d'une circonscription : « en Gironde », « dans l'Ain ».
 *
 * Repli sur « en <nom> » si le code est inconnu, ce qui ne devrait pas arriver —
 * les appelants ont déjà résolu le slug. Mieux vaut une préposition approximative
 * qu'une phrase trouée.
 */
export function locutionDepuisCode(code: string, nom: string): string {
  return LOCUTION_PAR_CODE.get(code) ?? `en ${nom}`;
}
