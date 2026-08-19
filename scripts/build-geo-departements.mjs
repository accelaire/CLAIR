/**
 * Génère `apps/web/lib/senatoriales/geo-departements.ts` — la table des contours
 * des départements métropolitains, en chemins SVG prêts à peindre.
 *
 * Pourquoi une table figée plutôt qu'un GeoJSON chargé à l'exécution : la carte
 * doit être rendue à trois endroits qui n'ont pas les mêmes moyens — le HTML
 * servi par le serveur, le navigateur, et Satori pour l'image Open Graph. Un
 * `<path d="...">` déjà projeté est le seul format que les trois savent peindre
 * sans bibliothèque ni calcul. Le prix à payer est un fichier généré à
 * committer ; il ne bouge que si le découpage administratif bouge.
 *
 * Source : france-geojson (Grégoire David), lui-même dérivé du découpage IGN.
 * Licence ouverte.
 *
 * Usage : node scripts/build-geo-departements.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson';

const CIBLE = new URL('../apps/web/lib/senatoriales/geo-departements.ts', import.meta.url);

/** Côté du carré de dessin. Les coordonnées émises tiennent dans [0, VIEWBOX]. */
const VIEWBOX = 1000;

/**
 * Tolérance de simplification, en mètres sur le terrain.
 *
 * La carte est lue à ~600 px de large pour ~1000 km de France, soit ~1,7 km par
 * pixel : un détail de 2,5 km pèse à peine plus d'un pixel. Descendre plus bas
 * multiplie le poids du fichier — qui voyage dans le HTML servi, dans la charge
 * utile React et dans le paquet JavaScript, soit trois fois par visiteur — pour
 * des sinuosités que personne ne distingue.
 */
const TOLERANCE_M = 2500;

/**
 * Surface minimale d'un anneau conservé, en km².
 *
 * Écarte les îlots qui, à l'échelle d'affichage, ne feraient pas un pixel — mais
 * pas les îles qui portent un sens (Ré, Oléron, Belle-Île restent au-dessus).
 */
const AIRE_MIN_KM2 = 12;

// --- Projection Lambert-93 (EPSG:2154) --------------------------------------
// La projection officielle française. Une simple mise à plat des longitudes
// donnerait une France penchée et trop large dans le Nord : la conique conforme
// est ce qui rend la silhouette reconnaissable.

const A = 6378137.0; // demi-grand axe GRS80
const E = 0.0818191910428158; // première excentricité GRS80
const rad = (d) => (d * Math.PI) / 180;

const LAT_0 = rad(46.5);
const LON_0 = rad(3);
const LAT_1 = rad(44);
const LAT_2 = rad(49);
const X_0 = 700000;
const Y_0 = 6600000;

const m = (phi) => Math.cos(phi) / Math.sqrt(1 - E * E * Math.sin(phi) ** 2);
const t = (phi) =>
  Math.tan(Math.PI / 4 - phi / 2) /
  ((1 - E * Math.sin(phi)) / (1 + E * Math.sin(phi))) ** (E / 2);

const N = Math.log(m(LAT_1) / m(LAT_2)) / Math.log(t(LAT_1) / t(LAT_2));
const F = m(LAT_1) / (N * t(LAT_1) ** N);
const RHO_0 = A * F * t(LAT_0) ** N;

function lambert93([lon, lat]) {
  const rho = A * F * t(rad(lat)) ** N;
  const theta = N * (rad(lon) - LON_0);
  return [X_0 + rho * Math.sin(theta), Y_0 + RHO_0 - rho * Math.cos(theta)];
}

// --- Simplification Douglas-Peucker -----------------------------------------

function distancePointSegment(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const norme = dx * dx + dy * dy;
  if (norme === 0) return Math.hypot(px - ax, py - ay);
  let u = ((px - ax) * dx + (py - ay) * dy) / norme;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/**
 * Douglas-Peucker, en itératif.
 *
 * La forme récursive naturelle déborde la pile d'appels : une commune de
 * Polynésie compte plusieurs milliers de points, et l'algorithme descend d'un
 * niveau par point conservé dans le pire cas.
 */
function simplifier(points, tolerance) {
  if (points.length <= 2) return points;

  const garder = new Uint8Array(points.length);
  garder[0] = 1;
  garder[points.length - 1] = 1;

  const aTraiter = [[0, points.length - 1]];
  while (aTraiter.length > 0) {
    const [debut, fin] = aTraiter.pop();
    let indexMax = -1;
    let distMax = tolerance;
    for (let i = debut + 1; i < fin; i++) {
      const d = distancePointSegment(points[i], points[debut], points[fin]);
      if (d > distMax) {
        distMax = d;
        indexMax = i;
      }
    }
    if (indexMax !== -1) {
      garder[indexMax] = 1;
      aTraiter.push([debut, indexMax], [indexMax, fin]);
    }
  }

  return points.filter((_, i) => garder[i] === 1);
}

/** Extremum d'une suite de nombres, sans `spread` : celui-ci déborde la pile
 *  au-delà de quelques dizaines de milliers d'éléments. */
function extremum(valeurs, comparer) {
  let resultat = valeurs[0];
  for (let i = 1; i < valeurs.length; i++) {
    if (comparer(valeurs[i], resultat)) resultat = valeurs[i];
  }
  return resultat;
}
const plusPetit = (v) => extremum(v, (a, b) => a < b);
const plusGrand = (v) => extremum(v, (a, b) => a > b);

/** Aire d'un anneau projeté (formule du lacet), en m². */
function aire(anneau) {
  let somme = 0;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    somme += anneau[j][0] * anneau[i][1] - anneau[i][0] * anneau[j][1];
  }
  return Math.abs(somme) / 2;
}

// --- Construction ------------------------------------------------------------

const reponse = await fetch(SOURCE);
if (!reponse.ok) throw new Error(`Source injoignable : HTTP ${reponse.status}`);
const geojson = await reponse.json();

// Seul l'anneau extérieur est retenu : les enclaves intérieures (le trou d'un
// département autour d'un autre) ne se voient pas à cette échelle, et les garder
// obligerait à gérer la règle de remplissage pair/impair dans trois moteurs de
// rendu différents.
const departements = geojson.features.map((f) => {
  const polygones =
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const anneaux = polygones
    .map((poly) => poly[0].map(lambert93))
    .filter((anneau) => aire(anneau) >= AIRE_MIN_KM2 * 1e6)
    .map((anneau) => simplifier(anneau, TOLERANCE_M));
  return { code: f.properties.code, nom: f.properties.nom, anneaux };
});

// Cadrage commun : toutes les coordonnées sont ramenées dans le même carré, pour
// que les chemins soient directement composables dans un `viewBox` fixe.
const tous = departements.flatMap((d) => d.anneaux.flat());
// `plusPetit`/`plusGrand` et non `Math.min(...)` : le nuage de points n'est
// petit que parce que TOLERANCE_M est large. Baisser la tolérance pour un tracé
// plus fin faisait déborder la pile ici, alors que la branche outre-mer, elle,
// passait sans broncher.
const minX = plusPetit(tous.map((p) => p[0]));
const maxX = plusGrand(tous.map((p) => p[0]));
const minY = plusPetit(tous.map((p) => p[1]));
const maxY = plusGrand(tous.map((p) => p[1]));
const echelle = VIEWBOX / Math.max(maxX - minX, maxY - minY);
const margeX = (VIEWBOX - (maxX - minX) * echelle) / 2;
const margeY = (VIEWBOX - (maxY - minY) * echelle) / 2;

/**
 * Coordonnées entières.
 *
 * Le carré fait 1000 unités pour une carte affichée autour de 600 px : l'unité
 * vaut déjà moins d'un pixel, et une décimale de plus n'ajouterait que des
 * caractères à transporter.
 */
const arrondi = (v) => Math.round(v);

function versChemin(anneaux) {
  return anneaux
    .map((anneau) => {
      const points = anneau.map(([x, y]) => [
        arrondi((x - minX) * echelle + margeX),
        // L'axe des Y du SVG descend, celui de la projection monte.
        arrondi(VIEWBOX - ((y - minY) * echelle + margeY)),
      ]);
      const [tete, ...reste] = points;
      return `M${tete[0]} ${tete[1]}` + reste.map(([x, y]) => `L${x} ${y}`).join('') + 'Z';
    })
    .join('');
}

const lignes = departements
  .sort((a, b) => a.code.localeCompare(b.code))
  .map((d) => `  '${d.code}': '${versChemin(d.anneaux)}',`)
  .join('\n');

const contenu = `/**
 * Contours des départements métropolitains, projetés en Lambert-93 et normalisés
 * dans un carré de ${VIEWBOX}×${VIEWBOX}.
 *
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Régénérer : \`node scripts/build-geo-departements.mjs\`
 *
 * Source : france-geojson (Grégoire David), d'après le découpage IGN, licence ouverte.
 * Simplifié à ${TOLERANCE_M} m près, anneaux de moins de ${AIRE_MIN_KM2} km² écartés.
 *
 * Les collectivités d'outre-mer et les Français établis hors de France n'y
 * figurent pas : la source ne les couvre pas, et les placer à leur position
 * réelle rendrait le cadrage inutilisable. La page les présente à côté de la
 * carte, sous forme de vignettes — treize sièges de la série 2 en dépendent.
 */

export const VIEWBOX_DEPARTEMENTS = ${VIEWBOX};

/** Code INSEE du département → chemin SVG fermé. */
export const CHEMINS_DEPARTEMENTS: Record<string, string> = {
${lignes}
};
`;

writeFileSync(CIBLE, contenu);

const poids = Buffer.byteLength(contenu);
console.log(
  `${departements.length} départements écrits dans ${CIBLE.pathname} (${(poids / 1024).toFixed(1)} Ko)`,
);

// --- Collectivités d'outre-mer -----------------------------------------------
//
// Cinq circonscriptions de la série 2 sont hors métropole et ne peuvent pas
// entrer dans le cadrage de la carte : la Guyane est à 7 000 km, la Polynésie à
// 15 000. Chacune reçoit son encart, normalisé sur sa propre étendue.
//
// La source change ici. Le découpage IGN ne couvre pas les collectivités
// d'outre-mer. Natural Earth les couvre, mais à une résolution calibrée pour un
// planisphère : onze points pour Saint-Barthélemy, soit un polygone quelconque
// là où l'île est très découpée. Les contours viennent donc d'OpenStreetMap, via
// Overpass, qui donne dix fois plus de détail — sauf pour la Guyane, dont les
// 487 points de Natural Earth suffisent largement à cette taille d'affichage.

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/**
 * Code de circonscription → emprise de recherche OSM (sud, ouest, nord, est).
 *
 * On y cherche les limites communales, `admin_level=8`, et non la limite du
 * territoire lui-même. Celle-ci — `admin_level` 2 ou 3 — englobe les eaux
 * territoriales : la relation de Saint-Barthélemy fait ainsi 51 km de côté pour
 * une île de 9 km, et son tracé n'est pas une côte mais une limite maritime. Le
 * niveau communal, lui, s'arrête au rivage.
 */
const OUTRE_MER_OSM = {
  '977': [17.85, -62.95, 18.0, -62.75], // Saint-Barthélemy
  '978': [18.0, -63.2, 18.15, -62.95], // Saint-Martin
  '986': [-14.4, -178.3, -13.2, -176.1], // Wallis-et-Futuna
  '987': [-28.2, -155.5, -7.5, -134.0], // Polynésie française
};

/** Côté de l'encart. Petit : ces contours se lisent en vignette. */
const VIEWBOX_OM = 100;

/**
 * Simplification des contours d'encart, en unités du carré de 100.
 *
 * Calée sur la taille d'affichage : un encart fait environ 64 px de côté pour
 * 100 unités, soit une unité et demie par pixel. Simplifier plus grossièrement
 * effaçait les découpes de Saint-Barthélemy et n'en laissait qu'une patate.
 */
const TOLERANCE_OM = 0.12;

/**
 * Diagonale minimale d'une île, en unités du carré de 100.
 *
 * Sans elle, la Polynésie est un carré vide et Wallis-et-Futuna deux poussières :
 * les îles s'étalent sur des centaines ou des milliers de kilomètres et aucune
 * n'atteint le pixel. Les trop petites sont donc agrandies autour de leur centre.
 * Leur forme et leur position restent exactes ; seule leur taille ment, et
 * l'interface le signale.
 *
 * Le seuil décroît avec le nombre d'îles : deux îles isolées peuvent être très
 * grossies sans gêne, soixante ne le peuvent pas sans se rejoindre en une tache
 * qui ne dirait plus rien de l'archipel.
 */
function diagonaleMinimale(nbAnneaux) {
  return Math.min(18, 80 / Math.sqrt(Math.max(nbAnneaux, 1)));
}

/** Recoud les tronçons Overpass en anneaux fermés ; ils arrivent en désordre. */
function recoudreAnneaux(troncons) {
  const restants = troncons.map((t) => t.slice());
  const anneaux = [];

  while (restants.length > 0) {
    let courant = restants.shift();
    let progresse = true;
    while (progresse) {
      progresse = false;
      const tete = courant[0];
      const queue = courant[courant.length - 1];
      if (tete.lat === queue.lat && tete.lon === queue.lon) break;
      for (let i = 0; i < restants.length; i++) {
        const t = restants[i];
        if (memeNoeud(t[t.length - 1], queue)) t.reverse();
        if (memeNoeud(t[0], queue)) {
          courant = courant.concat(t.slice(1));
          restants.splice(i, 1);
          progresse = true;
          break;
        }
        if (memeNoeud(t[0], tete)) t.reverse();
        if (memeNoeud(t[t.length - 1], tete)) {
          courant = t.slice(0, -1).concat(courant);
          restants.splice(i, 1);
          progresse = true;
          break;
        }
      }
    }
    if (courant.length >= 4) anneaux.push(courant.map((n) => [n.lon, n.lat]));
  }
  return anneaux;
}

const memeNoeud = (a, b) => a.lat === b.lat && a.lon === b.lon;

/**
 * Interroge Overpass, avec relances.
 *
 * L'instance publique renvoie régulièrement 429 (débit) et 504 (surcharge) sans
 * que la requête ait quoi que ce soit d'anormal. Sans relance, la génération
 * échoue une fois sur deux et donne l'impression d'un script cassé.
 */
async function anneauxOsm(emprise, essais = 4) {
  const [sud, ouest, nord, est] = emprise;
  const requete = `[out:json][timeout:180];\nrelation["boundary"="administrative"]["admin_level"="8"](${sud},${ouest},${nord},${est});\nout geom;`;

  let reponse;
  for (let essai = 1; essai <= essais; essai++) {
    reponse = await fetch(OVERPASS, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(requete),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Overpass répond 406 aux requêtes sans agent identifiable.
        'User-Agent': 'CLAIR.vote (generation des contours outre-mer)',
      },
    });
    if (reponse.ok) break;
    if (essai === essais) throw new Error(`Overpass : HTTP ${reponse.status}`);
    const attente = 30000 * essai;
    console.warn(`  HTTP ${reponse.status}, nouvelle tentative dans ${attente / 1000} s`);
    await new Promise((r) => setTimeout(r, attente));
  }

  const data = await reponse.json();
  const troncons = [];
  for (const rel of data.elements.filter((e) => e.type === 'relation')) {
    for (const membre of rel.members ?? []) {
      if (membre.type === 'way' && membre.role !== 'inner' && membre.geometry) {
        troncons.push(membre.geometry);
      }
    }
  }
  return recoudreAnneaux(troncons);
}

/** Anneaux de la Guyane, tirés de Natural Earth : sa taille rend le détail inutile. */
async function anneauxGuyane() {
  const reponse = await fetch(
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson',
  );
  if (!reponse.ok) throw new Error(`Natural Earth : HTTP ${reponse.status}`);
  const mondial = await reponse.json();
  const f = mondial.features.find((x) => x.properties.NAME === 'French Guiana');
  if (!f) throw new Error('Guyane introuvable dans Natural Earth');
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polys.map((p) => p[0]);
}

/**
 * Cache local des contours bruts.
 *
 * Overpass impose des pauses entre requêtes : une génération complète prend
 * trois minutes. Régler le grossissement des îlots en demande plusieurs, et
 * réinterroger une API publique pour des données qui ne bougent pas serait
 * autant impoli qu'inutile. Supprimer le fichier force le rechargement.
 */
const CACHE = new URL('./.cache-contours-outre-mer.json', import.meta.url);
let cache = {};
try {
  cache = JSON.parse(readFileSync(CACHE, 'utf8'));
  console.log('contours bruts relus du cache');
} catch {
  /* premier passage */
}

const encarts = {};
const territoires = [['973', anneauxGuyane]];
for (const [code, emprise] of Object.entries(OUTRE_MER_OSM)) {
  territoires.push([code, () => anneauxOsm(emprise)]);
}

for (const [code, charger] of territoires) {
  let brut = cache[code];
  if (!brut) {
    // Overpass limite le débit : une pause entre deux requêtes évite les 429.
    if (code !== '973') await new Promise((r) => setTimeout(r, 45000));
    brut = await charger();
    cache[code] = brut;
    writeFileSync(CACHE, JSON.stringify(cache));
  }

  // Projection locale : équirectangulaire redressée par le cosinus de la
  // latitude. Lambert-93 est calé sur la métropole et déformerait tout le reste.
  const latitudes = brut.flat().map(([, lat]) => lat);
  const facteur = Math.cos(rad((plusPetit(latitudes) + plusGrand(latitudes)) / 2));
  const projete = brut.map((a) => a.map(([lon, lat]) => [lon * facteur, lat]));

  const pts = projete.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const bx = [plusPetit(xs), plusGrand(xs)];
  const by = [plusPetit(ys), plusGrand(ys)];
  const etendue = Math.max(bx[1] - bx[0], by[1] - by[0]) || 1;
  const k = (VIEWBOX_OM * 0.92) / etendue;
  const decX = (VIEWBOX_OM - (bx[1] - bx[0]) * k) / 2;
  const decY = (VIEWBOX_OM - (by[1] - by[0]) * k) / 2;

  const normalises = projete.map((a) =>
    a.map(([x, y]) => [
      (x - bx[0]) * k + decX,
      VIEWBOX_OM - ((y - by[0]) * k + decY),
    ]),
  );

  const finaux = normalises
    .map((anneau) => simplifier(anneau, TOLERANCE_OM))
    .filter((anneau) => anneau.length >= 3)
    .map((anneau, _i, tous) => grossirSiMinuscule(anneau, diagonaleMinimale(tous.length)));

  encarts[code] = finaux
    .map((anneau) => {
      const p = anneau.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      const [tete, ...reste] = p;
      return `M${tete[0]} ${tete[1]}` + reste.map(([x, y]) => `L${x} ${y}`).join('') + 'Z';
    })
    .join('');
}

/**
 * Agrandit une île autour de son centre si elle serait invisible.
 *
 * L'homothétie préserve la forme et la position ; seule la taille est faussée,
 * et elle l'est déjà par le choix d'un encart par territoire.
 */
function grossirSiMinuscule(anneau, cible) {
  const xs = anneau.map((p) => p[0]);
  const ys = anneau.map((p) => p[1]);
  const [xMin, xMax] = [plusPetit(xs), plusGrand(xs)];
  const [yMin, yMax] = [plusPetit(ys), plusGrand(ys)];
  const diagonale = Math.hypot(xMax - xMin, yMax - yMin);
  if (diagonale >= cible || diagonale === 0) return anneau;

  const cx = (xMax + xMin) / 2;
  const cy = (yMax + yMin) / 2;
  const facteur = cible / diagonale;
  return anneau.map(([x, y]) => [cx + (x - cx) * facteur, cy + (y - cy) * facteur]);
}

const contenuOm = `/**
 * Contours des collectivités d'outre-mer de la série 2, un encart par territoire.
 *
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Régénérer : \`node scripts/build-geo-departements.mjs\`
 *
 * Sources : limites communales OpenStreetMap via Overpass (ODbL) pour
 * Saint-Barthélemy, Saint-Martin, Wallis-et-Futuna et la Polynésie française ;
 * Natural Earth (domaine public) pour la Guyane.
 *
 * Le découpage IGN ne couvre pas ces collectivités. Natural Earth les couvre
 * mais à une résolution de planisphère — onze points pour Saint-Barthélemy. Et
 * la limite du territoire dans OSM suit les eaux territoriales, pas la côte :
 * ce sont donc les limites communales qui sont assemblées ici.
 *
 * DEUX LIBERTÉS PRISES AVEC L'ÉCHELLE, que l'interface doit signaler :
 * 1. Chaque encart est normalisé sur sa propre étendue. Les tailles ne sont
 *    comparables ni entre encarts ni avec la carte de métropole.
 * 2. Les îles trop petites pour être vues sont agrandies autour de leur centre,
 *    d'autant plus qu'elles sont peu nombreuses. Sans quoi la Polynésie serait
 *    un carré vide. Leur forme et leur position sont exactes ; leur taille
 *    relative ne l'est pas.
 */

export const VIEWBOX_OUTRE_MER = ${VIEWBOX_OM};

/** Code de circonscription → chemin SVG, dans un carré de ${VIEWBOX_OM}×${VIEWBOX_OM}. */
export const CHEMINS_OUTRE_MER: Record<string, string> = {
${Object.entries(encarts)
  .map(([code, d]) => `  '${code}': '${d}',`)
  .join('\n')}
};
`;

writeFileSync(new URL('../apps/web/lib/senatoriales/geo-outre-mer.ts', import.meta.url), contenuOm);
console.log(
  `${Object.keys(encarts).length} encarts d'outre-mer écrits (${(Buffer.byteLength(contenuOm) / 1024).toFixed(1)} Ko)`,
);
