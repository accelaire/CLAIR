// =============================================================================
// Concordance entre l'orateur d'un compte rendu et la fiche que la source lui
// attribue
//
// Le compte rendu de l'Assemblée (syceron) donne, pour chaque paragraphe, le nom
// de l'orateur ET un identifiant d'acteur (`id_acteur`). L'identifiant se trompe
// parfois : la réponse d'Alice Rufo, ministre, porte celui de François Ruffin ;
// le second paragraphe d'une réponse d'Alain Griset, celui du député qui posait
// la question ; une audition de syndicalistes, ceux des députés présents ;
// « Un député du groupe LR » porte l'identifiant d'un député nommé. Le nom écrit
// au compte rendu fait foi : une fiche qui le contredit n'est pas retenue.
// =============================================================================

export type Concordance =
  /** Même personne : nom commun, et prénom commun quand le compte rendu en donne un. */
  | 'meme_personne'
  /** Nom d'usage différent, même prénom (Christine Cloarec, devenue Le Nabour). */
  | 'meme_prenom'
  /** Fonction sans nom (« le rapporteur général », « la ministre ») : rien à comparer. */
  | 'fonction'
  /** Plusieurs ou un anonyme (« Un député du groupe LR ») : personne en particulier. */
  | 'collectif'
  /** Un autre nom que celui de la fiche. */
  | 'autre_personne';

export interface NomPersonne {
  prenom: string | null;
  nom: string;
}

const PARTICULES = new Set(['de', 'la', 'le', 'du', 'des', 'd', 'l']);

/** Minuscules sans accents, sans le suffixe de groupe « (LIOT) ». */
function normaliser(valeur: string): string {
  return valeur
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Mots d'un nom ; l'apostrophe soude (« Prud’homme » = « Prud'homme » = prudhomme). */
function mots(valeur: string | null): Set<string> {
  const texte = normaliser(valeur ?? '').replace(/['’ʼ]/g, '');
  return new Set(texte.split(/[^a-z]+/).filter((m) => m.length > 0 && !PARTICULES.has(m)));
}

const intersecte = (a: Set<string>, b: Set<string>) => [...a].some((m) => b.has(m));

const COLLECTIF = /^(un|une|plusieurs|quelques|les|des|de nombreux|nombreux|nombreuses)\b.*\bdeputee?s?\b/;
const FONCTION =
  /^(m |mme |le |la |l )?(rapporteure?|ministre|president|presidente|secretaire d etat|garde des sceaux|premier ministre|premiere ministre)\b/;

export function concordanceOrateur(orateur: NomPersonne, fiche: NomPersonne): Concordance {
  const complet = `${orateur.prenom ?? ''} ${orateur.nom}`;
  const motsComplets = mots(complet);
  if (intersecte(mots(fiche.nom), motsComplets)) {
    // Même nom : le prénom départage les homonymes (Maud et Frédéric Petit),
    // quand le compte rendu en donne un. Une déclaration commune (« Bruno
    // Studer et Philippe Vigier ») nomme le prénom de la fiche plus loin.
    const prenomOrateur = mots(orateur.prenom);
    if (prenomOrateur.size === 0 || intersecte(mots(fiche.prenom), motsComplets)) return 'meme_personne';
    return 'autre_personne';
  }
  const phrase = normaliser(complet).replace(/[^a-z]+/g, ' ').trim();
  if (COLLECTIF.test(phrase)) return 'collectif';
  if (FONCTION.test(phrase)) return 'fonction';
  const prenomFiche = mots(fiche.prenom);
  if (prenomFiche.size > 0 && [...prenomFiche].every((m) => mots(orateur.prenom).has(m))) {
    const prenomOrateur = mots(orateur.prenom);
    if ([...prenomOrateur].every((m) => prenomFiche.has(m))) return 'meme_prenom';
  }
  return 'autre_personne';
}

/** La fiche que la source attribue à l'orateur peut-elle être retenue ? */
export function ficheRetenue(c: Concordance): boolean {
  return c === 'meme_personne' || c === 'meme_prenom' || c === 'fonction';
}

/** Une autre prise de la même séance, avec la fiche qu'elle désigne. */
export interface PriseAttribuee {
  orateur: NomPersonne;
  parlementaireId: string;
  fiche: NomPersonne;
}

/**
 * Fiche à rendre à une prise dont l'identifiant a été écarté : celle que porte,
 * ailleurs dans la même séance, le même orateur écrit à l'identique, si cette
 * fiche est unique et concorde pleinement avec son nom (`meme_personne` : ni
 * fonction, ni simple prénom commun). Sinon aucune.
 */
export function ficheDansLaSeance(orateur: NomPersonne, autres: readonly PriseAttribuee[]): string | null {
  const ids = new Set<string>();
  for (const a of autres) {
    if (a.orateur.nom !== orateur.nom || (a.orateur.prenom ?? null) !== (orateur.prenom ?? null)) continue;
    if (concordanceOrateur(orateur, a.fiche) !== 'meme_personne') continue;
    ids.add(a.parlementaireId);
  }
  return ids.size === 1 ? [...ids][0]! : null;
}
