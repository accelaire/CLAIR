// =============================================================================
// Couleurs des groupes politiques français
// =============================================================================

// Mapping des couleurs par nom de groupe (abréviations et noms complets)
export const GROUP_COLORS: Record<string, string> = {
  // Renaissance / Ensemble
  'REN': '#FFEB00',
  'Renaissance': '#FFEB00',
  'RE': '#FFEB00',
  'Ensemble pour la République': '#FFEB00',
  'EPR': '#FFEB00',

  // La France Insoumise
  'LFI': '#CC2443',
  'La France insoumise': '#CC2443',
  'LFI-NUPES': '#CC2443',
  'FI': '#CC2443',

  // Rassemblement National
  'RN': '#0D378A',
  'Rassemblement National': '#0D378A',
  'Rassemblement national': '#0D378A',

  // Les Républicains
  'LR': '#0066CC',
  'Les Républicains': '#0066CC',
  'Droite Républicaine': '#0066CC',
  'DR': '#0066CC',

  // Socialistes
  'SOC': '#FF8080',
  'Socialistes': '#FF8080',
  'PS': '#FF8080',
  'Socialistes et apparentés': '#FF8080',

  // Écologistes
  'ECO': '#00C000',
  'Écologiste': '#00C000',
  'Écologiste et Social': '#00C000',
  'EELV': '#00C000',
  'Ecologiste - NUPES': '#00C000',
  'EcoS': '#00C000',

  // MoDem
  'DEM': '#FF9900',
  'Démocrate': '#FF9900',
  'MoDem': '#FF9900',
  'Mouvement Démocrate': '#FF9900',
  'MODEM': '#FF9900',

  // Horizons
  'HOR': '#00BFFF',
  'Horizons': '#00BFFF',
  'Horizons et apparentés': '#00BFFF',

  // Communistes
  'GDR': '#DD0000',
  'Gauche démocrate et républicaine': '#DD0000',
  'GDR-NUPES': '#DD0000',
  'PCF': '#DD0000',
  'Communiste': '#DD0000',

  // LIOT
  'LIOT': '#8B4513',
  'Libertés, Indépendants, Outre-mer et Territoires': '#8B4513',

  // UDI
  'UDI': '#00FFFF',
  'UDI et Indépendants': '#00FFFF',

  // Non-inscrits
  'NI': '#AAAAAA',
  'Non inscrit': '#AAAAAA',
  'Non-inscrit': '#AAAAAA',
  'Non inscrits': '#AAAAAA',

  // Divers
  'DVG': '#FFC0CB',
  'DVD': '#ADD8E6',
  'DIV': '#808080',
};

// Couleurs par position politique
export const POSITION_COLORS: Record<string, string> = {
  'Extrême gauche': '#BB0000',
  'Gauche': '#FF6B6B',
  'Centre-gauche': '#FFB366',
  'Centre': '#FFEB00',
  'Centre-droit': '#87CEEB',
  'Droite': '#4A90D9',
  'Extrême droite': '#0D378A',
  'Non-inscrit': '#AAAAAA',
};

// Convertir RGB "r,g,b" en hex "#RRGGBB"
function rgbToHex(rgb: string): string | null {
  const parts = rgb.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  const [r, g, b] = parts;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Fonction pour obtenir la couleur d'un groupe
export function getGroupColor(
  groupName?: string | null,
  dbColor?: string | null,
  position?: string | null
): string {
  // 1. Si une couleur est définie en base
  if (dbColor && dbColor.trim() !== '') {
    // Convertir RGB en hex si nécessaire
    if (dbColor.includes(',')) {
      const hexColor = rgbToHex(dbColor);
      if (hexColor && hexColor !== '#000000') {
        return hexColor;
      }
    } else if (dbColor.startsWith('#') && dbColor !== '#000000' && dbColor !== '#000') {
      return dbColor;
    }
  }

  // 2. Chercher par nom de groupe
  if (groupName) {
    // Chercher la correspondance exacte
    if (GROUP_COLORS[groupName]) {
      return GROUP_COLORS[groupName];
    }

    // Chercher une correspondance partielle
    const normalizedName = groupName.toUpperCase();
    for (const [key, color] of Object.entries(GROUP_COLORS)) {
      if (normalizedName.includes(key.toUpperCase()) || key.toUpperCase().includes(normalizedName)) {
        return color;
      }
    }
  }

  // 3. Utiliser la position politique
  if (position && POSITION_COLORS[position]) {
    return POSITION_COLORS[position];
  }

  // 4. Couleur par défaut
  return '#6B7280'; // Gris neutre
}

// Palette de couleurs pour les graphiques (quand on n'a pas de groupe)
export const CHART_COLORS = [
  '#3b82f6', // Bleu
  '#8b5cf6', // Violet
  '#ec4899', // Rose
  '#f97316', // Orange
  '#eab308', // Jaune
  '#22c55e', // Vert
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#a855f7', // Violet clair
  '#f43f5e', // Rouge
  '#84cc16', // Lime
];
