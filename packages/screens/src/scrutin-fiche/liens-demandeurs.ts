/**
 * Liens dans « Vote demandé par » (portés de `formatDemandeurs` de apps/web, scrutin) : les noms de
 * groupe et de parlementaire cités par la source deviennent des liens vers leur fiche.
 *
 * Les groupes viennent de `/groupes` de la période du scrutin (nom complet, sans le « Groupe » du
 * Sénat), les parlementaires des votants du scrutin : aucune table de noms écrite à la main.
 */

/** Morceau du texte d'un demandeur : texte seul, ou lien. */
export type SegmentDemandeur = { texte: string; href?: string };

/** Nom à reconnaître dans le texte, et la fiche où il mène. */
export type CibleDemandeur = { nom: string; href: string };

/** En dessous, un nom (« RN », « Le Pen ») risque de se trouver au milieu d'autre chose. */
const LONGUEUR_MIN = 5;

const LIMITE = /[\s,.:;!?()[\]"'«»-]/u;

/**
 * Minuscules, sans accents, tirets unifiés, **caractère pour caractère** : la position d'un nom
 * trouvé dans le texte normalisé est aussi sa position dans le texte d'origine.
 */
const normaliser = (texte: string) =>
  Array.from(texte, (caractere) => {
    const simple = caractere
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[\u0096–—]/g, "-");
    // Un accent combinant isolé, ou un caractère qui changerait de longueur, reste tel quel.
    return simple.length === caractere.length ? simple : caractere;
  }).join("");

const estUneLimite = (texte: string, debut: number, fin: number) =>
  (debut === 0 || LIMITE.test(texte[debut - 1] ?? "")) &&
  (fin >= texte.length || LIMITE.test(texte[fin] ?? ""));

/**
 * Découpe le texte d'un demandeur en segments, liens compris. Le nom le plus long l'emporte
 * (« La France insoumise - Nouveau Front Populaire » avant « La France insoumise ») ; un nom n'est
 * reconnu qu'entier, entre deux limites de mot.
 */
export const segmenterDemandeur = (
  texte: string,
  cibles: readonly CibleDemandeur[],
): SegmentDemandeur[] => {
  const normalise = normaliser(texte);
  const trouves: Array<{ debut: number; fin: number; href: string }> = [];
  const candidats = cibles
    .map((cible) => ({ nom: normaliser(cible.nom.trim()), href: cible.href }))
    .filter((cible) => cible.nom.length >= LONGUEUR_MIN)
    .sort((a, b) => b.nom.length - a.nom.length);

  for (const { nom, href } of candidats) {
    let depart = 0;
    for (;;) {
      const debut = normalise.indexOf(nom, depart);
      if (debut === -1) break;
      const fin = debut + nom.length;
      const libre = trouves.every((t) => fin <= t.debut || debut >= t.fin);
      if (libre && estUneLimite(normalise, debut, fin)) trouves.push({ debut, fin, href });
      depart = debut + 1;
    }
  }

  trouves.sort((a, b) => a.debut - b.debut);
  const segments: SegmentDemandeur[] = [];
  let curseur = 0;
  for (const { debut, fin, href } of trouves) {
    if (debut > curseur) segments.push({ texte: texte.slice(curseur, debut) });
    segments.push({ texte: texte.slice(debut, fin), href });
    curseur = fin;
  }
  if (curseur < texte.length) segments.push({ texte: texte.slice(curseur) });
  return segments;
};

/** Noms sous lesquels un groupe peut être cité : nom complet, avec ou sans « Groupe », sigle long. */
export const nomsDuGroupe = (groupe: { nom: string; nomComplet: string | null }) => {
  const noms = [groupe.nom];
  if (groupe.nomComplet) {
    noms.push(groupe.nomComplet);
    const sansGroupe = groupe.nomComplet.replace(/^groupe\s+(?:du\s+|de\s+la\s+|des\s+)?/iu, "");
    if (sansGroupe !== groupe.nomComplet) noms.push(sansGroupe);
  }
  return noms;
};
