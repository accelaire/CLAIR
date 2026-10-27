import "server-only";
import {
  CHEMINS_DEPARTEMENTS,
  COULEUR_GROUPE_DEFAUT,
  couleurCarte,
  estMetropole,
  type PointActivite,
  type SiegesDepartement,
  VIEWBOX_DEPARTEMENTS,
} from "@clair/screens";

/**
 * Graphiques en SVG autonome pour les images partageables (repris de
 * `lib/senatoriales/svg-graphiques.ts` de apps/web) : aucun texte (resvg ne reçoit pas les
 * polices) et aucune couleur du thème (l'image est fabriquée hors navigateur).
 */

/** Fond des images partagées, aligné sur `OgLayout`. */
const FOND_OG = "#0c1222";
/** Départements non concernés, sur fond sombre. */
const HORS_SERIE_OG = "#1e293b";

const enveloppe = (largeur: number, hauteur: number, contenu: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}">${contenu}</svg>`;

/** Encode un SVG en `data:` (base64 : les chemins de la carte contiennent des caractères fragiles). */
export const versDataUri = (svg: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

/** Carte des sièges renouvelés, métropole seule (l'outre-mer est rappelé en texte à côté). */
export const carteSvg = (sieges: SiegesDepartement[]): string => {
  const parCode = new Map(sieges.map((s) => [s.code, s.sieges]));
  const maxSieges = sieges.reduce((max, s) => Math.max(max, s.sieges), 0);
  const chemins = Object.entries(CHEMINS_DEPARTEMENTS)
    .map(([code, d]) => {
      const nbSieges = parCode.get(code) ?? 0;
      const remplissage = nbSieges > 0 ? couleurCarte(nbSieges, maxSieges) : HORS_SERIE_OG;
      return `<path d="${d}" fill="${remplissage}" stroke="${FOND_OG}" stroke-width="2"/>`;
    })
    .join("");
  return enveloppe(VIEWBOX_DEPARTEMENTS, VIEWBOX_DEPARTEMENTS, chemins);
};

/** Total des sièges qui ne peuvent pas être portés par la carte. */
export const siegesHorsCarte = (sieges: SiegesDepartement[]): number =>
  sieges.filter((s) => !estMetropole(s.code)).reduce((somme, s) => somme + s.sieges, 0);

const LARGEUR_NUAGE = 1000;
const HEX = /^#[0-9a-f]{3,8}$/i;

/** Nuage interventions × amendements, ramenés au mois de mandat. */
export const nuageSvg = (points: PointActivite[], { hauteur = 420 } = {}): string => {
  const maxX = Math.max(...points.map((p) => p.interventions), 1);
  const maxY = Math.max(...points.map((p) => p.amendements), 1);
  // Une marge d'un rayon : sans elle, le sortant le plus actif serait coupé par le bord.
  const rayon = 8;
  const utileX = LARGEUR_NUAGE - rayon * 2;
  const utileY = hauteur - rayon * 2;
  const grille = [1, 2, 3, 4]
    .map((i) => {
      const y = rayon + utileY - (i / 4) * utileY;
      return `<line x1="0" x2="${LARGEUR_NUAGE}" y1="${y}" y2="${y}" stroke="#243049" stroke-width="2"/>`;
    })
    .join("");
  const disques = points
    .map((point) => {
      const x = rayon + (point.interventions / maxX) * utileX;
      const y = rayon + utileY - (point.amendements / maxY) * utileY;
      // Seule une couleur hexadécimale est recopiée dans l'attribut : la donnée de l'API ne doit
      // pas pouvoir y injecter de balisage.
      const couleur =
        point.couleur && HEX.test(point.couleur) ? point.couleur : COULEUR_GROUPE_DEFAUT;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rayon}" fill="${couleur}" fill-opacity="0.8"/>`;
    })
    .join("");
  return enveloppe(LARGEUR_NUAGE, hauteur, grille + disques);
};
