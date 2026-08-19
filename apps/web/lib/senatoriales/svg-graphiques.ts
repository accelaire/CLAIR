/**
 * Rendu des graphiques en SVG autonome, pour les images partageables.
 *
 * Ces fonctions produisent une chaîne SVG complète, destinée à être encodée en
 * `data:` et posée dans un `<img>` par Satori — le moteur qui fabrique les images
 * Open Graph. Deux contraintes gouvernent tout ce fichier :
 *
 * 1. Aucun texte. Satori confie la rastérisation des images à resvg, qui ne
 *    reçoit pas les polices chargées pour la page : un `<text>` ici sortirait
 *    vide ou dans une fonte de repli. Les libellés sont donc posés à côté, en
 *    éléments Satori, jamais dans le SVG.
 * 2. Aucune couleur héritée du thème. L'image est fabriquée hors navigateur, où
 *    ni les variables CSS ni `prefers-color-scheme` n'existent. Toutes les
 *    couleurs sont passées explicitement.
 *
 * Les mêmes calculs alimentent les composants de la page ; seul le rendu diffère.
 */

import { CHEMINS_DEPARTEMENTS, VIEWBOX_DEPARTEMENTS } from './geo-departements';
import {
  couleurCarte,
  estMetropole,
  type PointActivite,
  type SiegesDepartement,
} from './graphiques';

/** Fond des images partagées, aligné sur `OgLayout`. */
export const FOND_OG = '#0c1222';
/** Départements non concernés, sur fond sombre. */
const HORS_SERIE_OG = '#1e293b';

function enveloppe(largeur: number, hauteur: number, contenu: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}">${contenu}</svg>`;
}

/** Encode un SVG en `data:` utilisable comme source d'image. */
export function versDataUri(svg: string): string {
  // Base64 plutôt que l'encodage par pourcents : les chemins de la carte
  // contiennent des caractères que certains analyseurs d'URL tronquent.
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * Carte des sièges renouvelés.
 *
 * Ne dessine que la métropole, comme le composant de page : la table de contours
 * ne couvre pas les collectivités d'outre-mer. Les sièges qu'elles portent sont
 * rappelés en toutes lettres à côté de l'image.
 */
export function carteSvg(sieges: SiegesDepartement[]): string {
  const parCode = new Map(sieges.map((s) => [s.code, s.sieges]));
  const maxSieges = sieges.reduce((max, s) => Math.max(max, s.sieges), 0);

  const chemins = Object.entries(CHEMINS_DEPARTEMENTS)
    .map(([code, d]) => {
      const nbSieges = parCode.get(code) ?? 0;
      const remplissage = nbSieges > 0 ? couleurCarte(nbSieges, maxSieges) : HORS_SERIE_OG;
      return `<path d="${d}" fill="${remplissage}" stroke="${FOND_OG}" stroke-width="2"/>`;
    })
    .join('');

  return enveloppe(VIEWBOX_DEPARTEMENTS, VIEWBOX_DEPARTEMENTS, chemins);
}

/** Total des sièges qui ne peuvent pas être portés par la carte. */
export function siegesHorsCarte(sieges: SiegesDepartement[]): number {
  return sieges.filter((s) => !estMetropole(s.code)).reduce((somme, s) => somme + s.sieges, 0);
}

const LARGEUR_NUAGE = 1000;

/** Nuage interventions × amendements, ramenés au mois de mandat. */
export function nuageSvg(
  points: PointActivite[],
  options: { hauteur?: number } = {},
): string {
  const hauteur = options.hauteur ?? 420;
  const maxX = Math.max(...points.map((p) => p.interventions), 1);
  const maxY = Math.max(...points.map((p) => p.amendements), 1);
  // Les disques sont centrés sur leur valeur : sans cette marge d'un rayon, le
  // sortant le plus actif — celui qu'on vient précisément regarder — se retrouve
  // coupé en deux par le bord de l'image.
  const rayon = 8;
  const utileX = LARGEUR_NUAGE - rayon * 2;
  const utileY = hauteur - rayon * 2;

  const grille = [1, 2, 3, 4]
    .map((i) => {
      const y = rayon + utileY - (i / 4) * utileY;
      return `<line x1="0" x2="${LARGEUR_NUAGE}" y1="${y}" y2="${y}" stroke="#243049" stroke-width="2"/>`;
    })
    .join('');

  const disques = points
    .map((point) => {
      const x = rayon + (point.interventions / maxX) * utileX;
      const y = rayon + utileY - (point.amendements / maxY) * utileY;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rayon}" fill="${point.couleur}" fill-opacity="0.8"/>`;
    })
    .join('');

  return enveloppe(LARGEUR_NUAGE, hauteur, grille + disques);
}
