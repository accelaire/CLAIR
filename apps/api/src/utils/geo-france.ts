// =============================================================================
// Données géographiques françaises - Départements et Régions
// =============================================================================

export interface Region {
  code: string;
  nom: string;
  departements: string[];
}

export interface Departement {
  code: string;
  nom: string;
  region: string;
}

// Régions françaises avec leurs départements
export const REGIONS: Region[] = [
  {
    code: 'ARA',
    nom: 'Auvergne-Rhône-Alpes',
    departements: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  },
  {
    code: 'BFC',
    nom: 'Bourgogne-Franche-Comté',
    departements: ['21', '25', '39', '58', '70', '71', '89', '90'],
  },
  {
    code: 'BRE',
    nom: 'Bretagne',
    departements: ['22', '29', '35', '56'],
  },
  {
    code: 'CVL',
    nom: 'Centre-Val de Loire',
    departements: ['18', '28', '36', '37', '41', '45'],
  },
  {
    code: 'COR',
    nom: 'Corse',
    departements: ['2A', '2B'],
  },
  {
    code: 'GES',
    nom: 'Grand Est',
    departements: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  },
  {
    code: 'HDF',
    nom: 'Hauts-de-France',
    departements: ['02', '59', '60', '62', '80'],
  },
  {
    code: 'IDF',
    nom: 'Île-de-France',
    departements: ['75', '77', '78', '91', '92', '93', '94', '95'],
  },
  {
    code: 'NOR',
    nom: 'Normandie',
    departements: ['14', '27', '50', '61', '76'],
  },
  {
    code: 'NAQ',
    nom: 'Nouvelle-Aquitaine',
    departements: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  },
  {
    code: 'OCC',
    nom: 'Occitanie',
    departements: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  },
  {
    code: 'PDL',
    nom: 'Pays de la Loire',
    departements: ['44', '49', '53', '72', '85'],
  },
  {
    code: 'PAC',
    nom: "Provence-Alpes-Côte d'Azur",
    departements: ['04', '05', '06', '13', '83', '84'],
  },
  // Outre-mer
  {
    code: 'GUA',
    nom: 'Guadeloupe',
    departements: ['971'],
  },
  {
    code: 'MTQ',
    nom: 'Martinique',
    departements: ['972'],
  },
  {
    code: 'GUF',
    nom: 'Guyane',
    departements: ['973'],
  },
  {
    code: 'REU',
    nom: 'La Réunion',
    departements: ['974'],
  },
  {
    code: 'MAY',
    nom: 'Mayotte',
    departements: ['976'],
  },
  // Collectivités d'outre-mer avec représentation parlementaire
  {
    code: 'COM',
    nom: "Collectivités d'outre-mer",
    departements: ['975', '977', '978', '986', '987', '988'],
  },
  // Français de l'étranger
  {
    code: 'ETR',
    nom: 'Français établis hors de France',
    departements: ['099', 'ZZ'],
  },
];

// Départements français
export const DEPARTEMENTS: Departement[] = [
  { code: '01', nom: 'Ain', region: 'ARA' },
  { code: '02', nom: 'Aisne', region: 'HDF' },
  { code: '03', nom: 'Allier', region: 'ARA' },
  { code: '04', nom: 'Alpes-de-Haute-Provence', region: 'PAC' },
  { code: '05', nom: 'Hautes-Alpes', region: 'PAC' },
  { code: '06', nom: 'Alpes-Maritimes', region: 'PAC' },
  { code: '07', nom: 'Ardèche', region: 'ARA' },
  { code: '08', nom: 'Ardennes', region: 'GES' },
  { code: '09', nom: 'Ariège', region: 'OCC' },
  { code: '10', nom: 'Aube', region: 'GES' },
  { code: '11', nom: 'Aude', region: 'OCC' },
  { code: '12', nom: 'Aveyron', region: 'OCC' },
  { code: '13', nom: 'Bouches-du-Rhône', region: 'PAC' },
  { code: '14', nom: 'Calvados', region: 'NOR' },
  { code: '15', nom: 'Cantal', region: 'ARA' },
  { code: '16', nom: 'Charente', region: 'NAQ' },
  { code: '17', nom: 'Charente-Maritime', region: 'NAQ' },
  { code: '18', nom: 'Cher', region: 'CVL' },
  { code: '19', nom: 'Corrèze', region: 'NAQ' },
  { code: '2A', nom: 'Corse-du-Sud', region: 'COR' },
  { code: '2B', nom: 'Haute-Corse', region: 'COR' },
  { code: '21', nom: "Côte-d'Or", region: 'BFC' },
  { code: '22', nom: "Côtes-d'Armor", region: 'BRE' },
  { code: '23', nom: 'Creuse', region: 'NAQ' },
  { code: '24', nom: 'Dordogne', region: 'NAQ' },
  { code: '25', nom: 'Doubs', region: 'BFC' },
  { code: '26', nom: 'Drôme', region: 'ARA' },
  { code: '27', nom: 'Eure', region: 'NOR' },
  { code: '28', nom: 'Eure-et-Loir', region: 'CVL' },
  { code: '29', nom: 'Finistère', region: 'BRE' },
  { code: '30', nom: 'Gard', region: 'OCC' },
  { code: '31', nom: 'Haute-Garonne', region: 'OCC' },
  { code: '32', nom: 'Gers', region: 'OCC' },
  { code: '33', nom: 'Gironde', region: 'NAQ' },
  { code: '34', nom: 'Hérault', region: 'OCC' },
  { code: '35', nom: 'Ille-et-Vilaine', region: 'BRE' },
  { code: '36', nom: 'Indre', region: 'CVL' },
  { code: '37', nom: 'Indre-et-Loire', region: 'CVL' },
  { code: '38', nom: 'Isère', region: 'ARA' },
  { code: '39', nom: 'Jura', region: 'BFC' },
  { code: '40', nom: 'Landes', region: 'NAQ' },
  { code: '41', nom: 'Loir-et-Cher', region: 'CVL' },
  { code: '42', nom: 'Loire', region: 'ARA' },
  { code: '43', nom: 'Haute-Loire', region: 'ARA' },
  { code: '44', nom: 'Loire-Atlantique', region: 'PDL' },
  { code: '45', nom: 'Loiret', region: 'CVL' },
  { code: '46', nom: 'Lot', region: 'OCC' },
  { code: '47', nom: 'Lot-et-Garonne', region: 'NAQ' },
  { code: '48', nom: 'Lozère', region: 'OCC' },
  { code: '49', nom: 'Maine-et-Loire', region: 'PDL' },
  { code: '50', nom: 'Manche', region: 'NOR' },
  { code: '51', nom: 'Marne', region: 'GES' },
  { code: '52', nom: 'Haute-Marne', region: 'GES' },
  { code: '53', nom: 'Mayenne', region: 'PDL' },
  { code: '54', nom: 'Meurthe-et-Moselle', region: 'GES' },
  { code: '55', nom: 'Meuse', region: 'GES' },
  { code: '56', nom: 'Morbihan', region: 'BRE' },
  { code: '57', nom: 'Moselle', region: 'GES' },
  { code: '58', nom: 'Nièvre', region: 'BFC' },
  { code: '59', nom: 'Nord', region: 'HDF' },
  { code: '60', nom: 'Oise', region: 'HDF' },
  { code: '61', nom: 'Orne', region: 'NOR' },
  { code: '62', nom: 'Pas-de-Calais', region: 'HDF' },
  { code: '63', nom: 'Puy-de-Dôme', region: 'ARA' },
  { code: '64', nom: 'Pyrénées-Atlantiques', region: 'NAQ' },
  { code: '65', nom: 'Hautes-Pyrénées', region: 'OCC' },
  { code: '66', nom: 'Pyrénées-Orientales', region: 'OCC' },
  { code: '67', nom: 'Bas-Rhin', region: 'GES' },
  { code: '68', nom: 'Haut-Rhin', region: 'GES' },
  { code: '69', nom: 'Rhône', region: 'ARA' },
  { code: '70', nom: 'Haute-Saône', region: 'BFC' },
  { code: '71', nom: 'Saône-et-Loire', region: 'BFC' },
  { code: '72', nom: 'Sarthe', region: 'PDL' },
  { code: '73', nom: 'Savoie', region: 'ARA' },
  { code: '74', nom: 'Haute-Savoie', region: 'ARA' },
  { code: '75', nom: 'Paris', region: 'IDF' },
  { code: '76', nom: 'Seine-Maritime', region: 'NOR' },
  { code: '77', nom: 'Seine-et-Marne', region: 'IDF' },
  { code: '78', nom: 'Yvelines', region: 'IDF' },
  { code: '79', nom: 'Deux-Sèvres', region: 'NAQ' },
  { code: '80', nom: 'Somme', region: 'HDF' },
  { code: '81', nom: 'Tarn', region: 'OCC' },
  { code: '82', nom: 'Tarn-et-Garonne', region: 'OCC' },
  { code: '83', nom: 'Var', region: 'PAC' },
  { code: '84', nom: 'Vaucluse', region: 'PAC' },
  { code: '85', nom: 'Vendée', region: 'PDL' },
  { code: '86', nom: 'Vienne', region: 'NAQ' },
  { code: '87', nom: 'Haute-Vienne', region: 'NAQ' },
  { code: '88', nom: 'Vosges', region: 'GES' },
  { code: '89', nom: 'Yonne', region: 'BFC' },
  { code: '90', nom: 'Territoire de Belfort', region: 'BFC' },
  { code: '91', nom: 'Essonne', region: 'IDF' },
  { code: '92', nom: 'Hauts-de-Seine', region: 'IDF' },
  { code: '93', nom: 'Seine-Saint-Denis', region: 'IDF' },
  { code: '94', nom: 'Val-de-Marne', region: 'IDF' },
  { code: '95', nom: "Val-d'Oise", region: 'IDF' },
  // Outre-mer
  { code: '971', nom: 'Guadeloupe', region: 'GUA' },
  { code: '972', nom: 'Martinique', region: 'MTQ' },
  { code: '973', nom: 'Guyane', region: 'GUF' },
  { code: '974', nom: 'La Réunion', region: 'REU' },
  { code: '976', nom: 'Mayotte', region: 'MAY' },
  // Collectivités d'outre-mer
  { code: '975', nom: 'Saint-Pierre-et-Miquelon', region: 'COM' },
  { code: '977', nom: 'Saint-Barthélemy', region: 'COM' },
  { code: '978', nom: 'Saint-Martin', region: 'COM' },
  { code: '986', nom: 'Wallis-et-Futuna', region: 'COM' },
  { code: '987', nom: 'Polynésie française', region: 'COM' },
  { code: '988', nom: 'Nouvelle-Calédonie', region: 'COM' },
  // Français de l'étranger
  { code: '099', nom: 'Français établis hors de France', region: 'ETR' },
  { code: 'ZZ', nom: 'Français établis hors de France', region: 'ETR' },
];

// Normalisation pour la recherche (suppression des accents et mise en minuscules)
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Recherche les codes de départements correspondant à un terme de recherche
 * Cherche dans les noms de départements et de régions
 */
export function findDepartementCodesBySearchTerm(searchTerm: string): string[] {
  const normalizedSearch = normalizeForSearch(searchTerm);
  const matchingCodes = new Set<string>();

  // Chercher dans les départements
  for (const dept of DEPARTEMENTS) {
    const normalizedNom = normalizeForSearch(dept.nom);
    if (normalizedNom.includes(normalizedSearch) || normalizedSearch.includes(normalizedNom)) {
      matchingCodes.add(dept.code);
    }
    // Chercher aussi par code département (ex: "75", "13")
    if (dept.code === searchTerm || dept.code === searchTerm.padStart(2, '0')) {
      matchingCodes.add(dept.code);
    }
  }

  // Chercher dans les régions
  for (const region of REGIONS) {
    const normalizedNom = normalizeForSearch(region.nom);
    if (normalizedNom.includes(normalizedSearch) || normalizedSearch.includes(normalizedNom)) {
      // Ajouter tous les départements de la région
      for (const deptCode of region.departements) {
        matchingCodes.add(deptCode);
      }
    }
  }

  return Array.from(matchingCodes);
}

/**
 * Vérifie si un terme de recherche correspond à une zone géographique
 */
export function isGeographicSearch(searchTerm: string): boolean {
  return findDepartementCodesBySearchTerm(searchTerm).length > 0;
}
