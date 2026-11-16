// Côté Figma : reçoit les captures préparées par ui.html (un écran à la fois) et crée les calques.
//
// Le plan Starter limite un fichier à 3 pages : tout va sur la page ouverte, en sections imbriquées.
//   section de partie « Écrans 0 · Accueil et recherche » (empilées de haut en bas)
//     └ section d'écran « 01-accueil · Accueil » (alignées de gauche à droite)
//         └ cadres séparés : Site actuel · ordinateur, Site actuel · mobile, Bêta · ordinateur,
//           Bêta · mobile, Notes
// Les composants suivent le même schéma : section « Composants », une sous-section par famille, un
// cadre par composant. Relancer l'import reconstruit la section de l'écran, à la même place.

figma.showUI(__html__, { width: 440, height: 600 });

const REGULIER = { family: "Inter", style: "Regular" };
const GRAS = { family: "Inter", style: "Bold" };
const GRIS = { r: 0.45, g: 0.47, b: 0.5 };
const NOIR = { r: 0.12, g: 0.12, b: 0.12 };
const CLAIR = { r: 0.88, g: 0.88, b: 0.88 };
const FOND_CARTE = { r: 0x33 / 255, g: 0x33 / 255, b: 0x33 / 255 }; // #333333 derrière les captures
const STATUTS = {
  mieux: { libelle: "Mieux que l'ancienne", fond: { r: 0.7, g: 0.95, b: 0.73 } },
  parite: { libelle: "À parité", fond: { r: 0.65, g: 0.85, b: 1 } },
};

const MARGE = 160; // dans une section, autour du contenu
const ECART_CADRES = 120; // entre deux cadres d'un écran
const ECART_ECRANS = 400; // entre deux sections d'écran
const ECART_PARTIES = 1200; // entre deux sections de partie
const NOMS_PARTIES = /^(Écrans \d|Composants)/;
const LOIN = 1e7; // position provisoire d'un nouvel élément, pour qu'il se range en dernier

const texte = (chaine, taille, gras, couleur) => {
  const t = figma.createText();
  t.fontName = gras ? GRAS : REGULIER;
  t.fontSize = taille;
  t.characters = chaine;
  t.fills = [{ type: "SOLID", color: couleur || NOIR }];
  return t;
};

/** Cadre en auto-layout, à la taille de son contenu. */
const pile = (nom, sens, espace, marge) => {
  const f = figma.createFrame();
  f.name = nom;
  f.layoutMode = sens;
  f.primaryAxisSizingMode = "AUTO";
  f.counterAxisSizingMode = "AUTO";
  f.itemSpacing = espace;
  f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = marge;
  f.fills = [];
  f.clipsContent = false;
  return f;
};

/** Texte qui prend la largeur de son parent et s'allonge en hauteur. */
const ajouterTexte = (parent, t) => {
  parent.appendChild(t);
  t.layoutAlign = "STRETCH";
  t.textAutoResize = "HEIGHT";
  return t;
};

/** Une capture, éventuellement en tuiles de 4096 px, empilées bout à bout. */
const capture = (nom, tuiles, echelle) => {
  const f = pile(nom, "VERTICAL", 0, 0);
  tuiles.forEach((tuile, i) => {
    const image = figma.createImage(tuile.octets);
    const r = figma.createRectangle();
    r.name = tuiles.length > 1 ? `${nom} (${i + 1}/${tuiles.length})` : nom;
    r.resize(tuile.largeur * echelle, tuile.hauteur * echelle);
    r.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
    f.appendChild(r);
  });
  return f;
};

// ——— Sections ———

/** Sous-section `nom` de `parent`, créée en dernière position si besoin. */
const sousSection = (parent, nom) => {
  // Un cadre du même nom vient d'un import précédent (un seul cadre par écran) : on le remplace.
  for (const n of parent.children.filter((n) => n.type !== "SECTION" && n.name === nom)) n.remove();
  let s = parent.children.find((n) => n.type === "SECTION" && n.name === nom);
  if (!s) {
    s = figma.createSection();
    s.name = nom;
    s.resizeWithoutConstraints(100, 100);
    parent.appendChild(s);
    s.x = LOIN;
    s.y = MARGE;
  }
  return s;
};

/** Section de partie sur la page ouverte, créée sous tout le reste si besoin. */
const sectionPartie = (nom) => {
  const page = figma.currentPage;
  let s = page.children.find((n) => n.type === "SECTION" && n.name === nom);
  if (!s) {
    const bas = page.children.reduce((m, n) => Math.max(m, n.y + n.height), -ECART_PARTIES);
    const gauche = page.children.length ? Math.min(...page.children.map((n) => n.x)) : 0;
    s = figma.createSection();
    s.name = nom;
    s.resizeWithoutConstraints(100, 100);
    page.appendChild(s);
    s.x = gauche;
    s.y = bas + ECART_PARTIES;
  }
  return s;
};

/** Range les enfants d'une section bout à bout (H : de gauche à droite, V : de haut en bas), puis
 *  ajuste la section à son contenu : une section ne s'agrandit pas seule. */
const ranger = (section, sens, ecart) => {
  const h = sens === "H";
  const enfants = [...section.children].sort((a, b) => (h ? a.x - b.x : a.y - b.y));
  let pos = MARGE;
  for (const n of enfants) {
    n.x = h ? pos : MARGE;
    n.y = h ? MARGE : pos;
    pos += (h ? n.width : n.height) + ecart;
  }
  const l = enfants.reduce((m, n) => Math.max(m, n.x + n.width), 0) + MARGE;
  const t = enfants.reduce((m, n) => Math.max(m, n.y + n.height), 0) + MARGE;
  section.resizeWithoutConstraints(Math.max(l, 100), Math.max(t, 100));
};

/** Réempile les sections de partie de l'import, sans toucher au reste de la page. */
const rangerPage = () => {
  const parties = figma.currentPage.children
    .filter((n) => n.type === "SECTION" && NOMS_PARTIES.test(n.name))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < parties.length; i++) {
    parties[i].x = parties[0].x;
    parties[i].y = parties[i - 1].y + parties[i - 1].height + ECART_PARTIES;
  }
};

/** Vide la section d'un écran (ou d'une famille) avant de la reconstruire. */
const vider = (s) => {
  for (const n of [...s.children]) n.remove();
};

/** Pose les cadres dans la section, dans l'ordre donné. */
const remplir = (s, cadres, sens) => {
  cadres.forEach((c, i) => {
    s.appendChild(c);
    c.x = sens === "H" ? i : MARGE; // l'ordre suffit, ranger() calcule les positions
    c.y = sens === "H" ? MARGE : i;
  });
};

// ——— Cadres ———

/** Carte d'une capture : fond #333333, libellé, image. */
const carteCapture = (col) => {
  const c = pile(col.libelle, "VERTICAL", 32, 48);
  c.fills = [{ type: "SOLID", color: FOND_CARTE }];
  c.cornerRadius = 24;
  c.appendChild(texte(col.libelle, 28, true, CLAIR));
  if (col.tuiles.length) c.appendChild(capture(col.fichier, col.tuiles, col.echelle));
  else c.appendChild(texte("(pas de capture)", 20, false, CLAIR));
  return c;
};

const carteNotes = (nom, notes) => {
  const n = pile("Notes", "VERTICAL", 20, 32);
  n.counterAxisSizingMode = "FIXED";
  n.resize(560, n.height);
  n.cornerRadius = 24;
  n.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.98 } }];
  ajouterTexte(n, texte(nom, 32, true));
  const statut = STATUTS[notes.statut] || STATUTS.parite;
  const pastille = pile("Statut", "HORIZONTAL", 0, 12);
  pastille.cornerRadius = 8;
  pastille.fills = [{ type: "SOLID", color: statut.fond }];
  pastille.appendChild(texte(statut.libelle, 22, true));
  n.appendChild(pastille);
  const liste = (titre, items) => {
    if (!items || !items.length) return;
    ajouterTexte(n, texte(titre, 24, true));
    ajouterTexte(n, texte(items.map((x) => `• ${x}`).join("\n"), 20));
  };
  liste("Ce qui a changé", notes.modifie);
  liste("À améliorer", notes.ameliorer);
  ajouterTexte(n, texte("Commentaires", 24, true));
  ajouterTexte(n, texte("Utiliser les commentaires Figma directement sur les captures.", 18, false, GRIS));
  return n;
};

const carteComposant = (comp) => {
  const carte = pile(comp.nom, "VERTICAL", 24, 40);
  carte.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  carte.cornerRadius = 24;
  carte.appendChild(texte(comp.nom, 28, true));
  const variantes = pile("Variantes", "HORIZONTAL", 40, 0);
  for (const v of comp.variantes) {
    const c = pile(v.libelle, "VERTICAL", 8, 0);
    c.appendChild(texte(v.libelle, 18, false, GRIS));
    c.appendChild(capture(`${comp.nom} — ${v.libelle}`, v.tuiles, v.echelle));
    variantes.appendChild(c);
  }
  carte.appendChild(variantes);
  return carte;
};

// ——— Messages ———

let dernier = null;

figma.ui.onmessage = async (m) => {
  try {
    if (m.type === "commencer") {
      await Promise.all([figma.loadFontAsync(REGULIER), figma.loadFontAsync(GRAS)]);
      dernier = null;
    } else if (m.type === "ecran" || m.type === "famille") {
      const partie = sectionPartie(m.section);
      const s = sousSection(partie, m.nom);
      vider(s);
      if (m.type === "ecran") {
        const cadres = m.colonnes.map(carteCapture);
        if (m.notes) cadres.push(carteNotes(m.nom, m.notes));
        remplir(s, cadres, "H");
        ranger(s, "H", ECART_CADRES);
      } else {
        remplir(s, m.composants.map(carteComposant), "V");
        ranger(s, "V", ECART_CADRES);
      }
      ranger(partie, "H", ECART_ECRANS);
      rangerPage();
      if (!dernier) dernier = s;
    } else if (m.type === "fin") {
      if (dernier) figma.viewport.scrollAndZoomIntoView([dernier]);
      figma.notify("Import terminé");
    } else if (m.type === "fermer") {
      figma.closePlugin();
      return;
    }
    figma.ui.postMessage({ type: "ok" });
  } catch (e) {
    figma.ui.postMessage({ type: "erreur", message: String((e && e.message) || e) });
  }
};
