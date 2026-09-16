// =============================================================================
// Lecture d'un débat : le découper comme la séance l'a mené
// =============================================================================
//
// Le compte rendu de l'Assemblée déclare, sur chaque prise de parole, le texte
// en discussion, l'article examiné et l'amendement défendu. Une liste à plat
// perd cette structure : on y lit cinquante prises de parole d'affilée sans
// savoir laquelle répond à laquelle, ni sur quoi porte le passage qu'on lit.
//
// Le regroupement suit l'ordre de la séance au lieu de le recomposer : un
// débat se déroule, il ne se trie pas. Deux passages sur le même article, de
// part et d'autre d'un autre sujet, restent donc deux passages distincts —
// c'est ainsi que la séance s'est tenue.
//
// LE TEXTE. Le compte rendu ne le nomme que par son numéro de dépôt (« 1364 »),
// résolu en dossier à l'ingestion. Sur la fiche d'un député, qui traverse des
// dizaines de textes, l'intertitre doit le dire : « Article 2 · Amendement
// n° 512 » seul ne permet pas de savoir de quelle loi on parle. Sur la page
// d'un scrutin, où tout porte sur le même texte, le répéter serait du bruit —
// d'où l'option `avecTexte`.
//
// LES VOTES. Chaque prise de parole porte les scrutins qu'elle a précédés. On
// les remonte au passage plutôt qu'à la séance : une journée de séance compte
// souvent plusieurs dizaines de votes, et les afficher tous sous une seule
// intervention laissait croire qu'elle portait sur chacun d'eux.

/** Le texte en discussion, tel que l'API le rend. */
export interface DossierDeDebat {
  uid: string;
  titre: string;
}

/** Ce qu'il faut d'une prise de parole pour la situer dans le débat. */
export interface InterventionSituee {
  articleVise?: string | null;
  amendementsVises?: string[] | null;
  texteNumero?: string | null;
  dossier?: DossierDeDebat | null;
  /** Les votes que cette prise de parole a précédés, quand on le sait. */
  scrutinIds?: string[];
}

export interface GroupeDeDebat<T> {
  /** Stable au sein d'une liste : sert de clé de rendu. */
  cle: string;
  /** L'intertitre complet, ou `null` quand la séance ne dit rien. */
  titre: string | null;
  /**
   * L'intertitre SANS le texte : « Article 2 · Amendement n° 512 ».
   *
   * Rendu à part pour que l'appelant puisse faire du texte un lien sans
   * redécouper `titre` — le titre d'un dossier peut contenir n'importe quoi.
   */
  sousTitre: string | null;
  /** Le texte en discussion, pour en faire un lien. */
  dossier: DossierDeDebat | null;
  /** Les votes de ce passage, dédoublonnés et dans l'ordre rencontré. */
  scrutinIds: string[];
  interventions: T[];
}

export interface OptionsDeGroupement {
  /** Nommer le texte dans l'intertitre. Faux sur la page d'un scrutin. */
  avecTexte?: boolean;
}

/**
 * Découpe une suite de prises de parole en passages consécutifs de même sujet.
 *
 * Le sujet est l'amendement quand il est nommé, l'article sinon, et le texte
 * les englobe : passer d'un texte à l'autre ouvre toujours un nouveau passage,
 * même à numéro d'article identique — l'article 2 d'une loi n'est pas l'article
 * 2 de la suivante. Les prises de parole que le compte rendu ne situe pas
 * forment leurs propres passages, sans intertitre : mieux vaut ne rien annoncer
 * que d'annoncer à tort.
 */
export function grouperParSujet<T extends InterventionSituee>(
  interventions: T[],
  options: OptionsDeGroupement = {},
): GroupeDeDebat<T>[] {
  const groupes: GroupeDeDebat<T>[] = [];

  for (const intervention of interventions) {
    const cle = cleDuSujet(intervention);
    const dernier = groupes[groupes.length - 1];

    if (dernier && dernier.cle.startsWith(`${cle}#`)) {
      dernier.interventions.push(intervention);
      ajouterScrutins(dernier, intervention);
      continue;
    }

    const groupe: GroupeDeDebat<T> = {
      // Le rang suffixé distingue deux passages sur le même article séparés
      // par un autre sujet, que React confondrait sous une clé identique.
      cle: `${cle}#${groupes.length}`,
      titre: titreDuSujet(intervention, options.avecTexte ?? false),
      sousTitre: titreDuSujet(intervention, false),
      dossier: options.avecTexte ? (intervention.dossier ?? null) : null,
      scrutinIds: [],
      interventions: [intervention],
    };
    ajouterScrutins(groupe, intervention);
    groupes.push(groupe);
  }

  return groupes;
}

function ajouterScrutins<T extends InterventionSituee>(
  groupe: GroupeDeDebat<T>,
  intervention: InterventionSituee,
): void {
  for (const id of intervention.scrutinIds ?? []) {
    if (!groupe.scrutinIds.includes(id)) groupe.scrutinIds.push(id);
  }
}

function cleDuSujet(i: InterventionSituee): string {
  const amendements = (i.amendementsVises ?? []).join(',');
  const texte = i.dossier?.uid ?? i.texteNumero ?? '';
  return `${texte}|${i.articleVise ?? ''}|${amendements}`;
}

function titreDuSujet(i: InterventionSituee, avecTexte: boolean): string | null {
  const parties: string[] = [];

  if (avecTexte) {
    const texte = libelleTexte(i);
    if (texte) parties.push(texte);
  }

  const article = libelleArticle(i.articleVise);
  if (article) parties.push(article);

  const amendements = i.amendementsVises ?? [];
  if (amendements.length > 0) {
    const numeros = amendements.map((n) => `n° ${n}`).join(', ');
    parties.push(amendements.length > 1 ? `Amendements ${numeros}` : `Amendement ${numeros}`);
  }

  return parties.length > 0 ? parties.join(' · ') : null;
}

/**
 * Le nom du texte, ou son numéro de dépôt à défaut.
 *
 * 88,6 % des prises de parole de la 17e législature trouvent leur dossier ;
 * pour les autres — textes du Sénat, textes anciens, textes sans amendement —
 * on affiche « Texte n° 3995 » plutôt que rien : le numéro est ce que le compte
 * rendu dit, et il permet au moins de suivre d'un passage à l'autre.
 */
function libelleTexte(i: InterventionSituee): string | null {
  if (i.dossier) return i.dossier.titre;
  return i.texteNumero ? `Texte n° ${i.texteNumero}` : null;
}

// =============================================================================
// Nommer une séance
// =============================================================================

/**
 * « vendredi 26 juin 2026, 9 heures ».
 *
 * POURQUOI L'HEURE. L'Assemblée siège deux ou trois fois le même jour — 587
 * jours sur 734 dans la 17e législature. Sans elle, la fiche d'un député
 * empilait trois blocs « Séance du vendredi 26 juin 2026 » rigoureusement
 * identiques, sans moyen de savoir laquelle on lisait.
 *
 * POURQUOI PAS « 1re SÉANCE ». C'est ainsi que l'Assemblée les numérote, mais
 * le rang se compte sur les séances DU JOUR, pas sur celles où ce député a
 * parlé. Le déduire de nos propres lignes donnerait « 2e séance » à qui n'a
 * parlé qu'à la deuxième et à la troisième. L'heure, elle, est un fait porté
 * par la donnée.
 *
 * POURQUOI UTC. La colonne est un horodatage sans fuseau : elle contient
 * l'heure de Paris, et l'API la sérialise avec un `Z`. La rendre dans le fuseau
 * du lecteur afficherait 11 heures pour une séance de 9 heures.
 *
 * Le Sénat ne nous donne pas l'heure — ses 91 017 prises sont toutes à minuit —
 * et on n'annonce donc rien plutôt que « 0 heure ».
 */
export function libelleDeSeance(date: string | Date): string {
  const quand = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(quand.getTime())) return '';

  const jour = quand.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const heures = quand.getUTCHours();
  const minutes = quand.getUTCMinutes();
  if (heures === 0 && minutes === 0) return jour;

  const heure =
    minutes === 0
      ? `${heures} heure${heures > 1 ? 's' : ''}`
      : `${heures} h ${String(minutes).padStart(2, '0')}`;
  return `${jour}, ${heure}`;
}

/**
 * `"15"` → `"Article 15"`, `"unique"` → `"Article unique"`.
 *
 * Le compte rendu écrit le rang tel qu'il le prononce — « unique », « 1er »,
 * « 4 bis » — et on le reprend sans chercher à le normaliser.
 */
function libelleArticle(article: string | null | undefined): string | null {
  if (!article) return null;
  const propre = article.trim();
  if (propre.length === 0) return null;
  return /^article\b/i.test(propre) ? propre : `Article ${propre}`;
}

// =============================================================================
// L'ordre du jour comme fil de la séance
// =============================================================================

/** Un point de l'ordre du jour, situé par le rang où la présidence l'annonce. */
export interface PointDeLOrdreDuJour {
  ordre: number;
  titre: string;
}

/** Un passage du débat, précédé du point de l'ordre du jour qu'il ouvre. */
export interface GroupeAnnonce<T> {
  groupe: GroupeDeDebat<T>;
  /**
   * Le point de l'ordre du jour que ce passage ouvre, ou `null` s'il poursuit
   * celui du passage précédent. N'est donc renseigné qu'au changement.
   */
  ouverture: string | null;
}

/**
 * Replace chaque passage sous le point de l'ordre du jour qui le gouverne.
 *
 * POURQUOI. La présidence annonce chaque point de la journée — « L'ordre du
 * jour appelle la discussion, sur le rapport de la commission mixte paritaire,
 * de la proposition de loi visant à… ». C'est elle qui donne l'étape de lecture
 * du texte, que le seul lien vers le dossier ne dit pas, et c'est elle qui
 * découpe la journée. Ces annonces sont écartées des prises de fond, à raison :
 * elles ne comptent pas comme des interventions. Elles font en revanche de bons
 * intertitres.
 *
 * COMMENT. Un passage relève du dernier point annoncé avant lui. On compare les
 * rangs, qui ordonnent le compte rendu ; un passage dont on ignore le rang ne
 * réclame aucun point plutôt que d'en réclamer un au hasard. Le titre n'est
 * rendu qu'au changement : le répéter au-dessus de chaque passage d'une même
 * discussion noierait le découpage par sujet qu'il est censé éclairer.
 */
export function annoterOrdreDuJour<T extends InterventionSituee & { ordre?: number | null }>(
  groupes: GroupeDeDebat<T>[],
  points: readonly PointDeLOrdreDuJour[] | undefined,
): GroupeAnnonce<T>[] {
  if (!points || points.length === 0) {
    return groupes.map((groupe) => ({ groupe, ouverture: null }));
  }

  const ordonnes = [...points].sort((a, b) => a.ordre - b.ordre);
  let dernierRendu: string | null = null;

  return groupes.map((groupe) => {
    const rang = groupe.interventions[0]?.ordre;
    if (rang === null || rang === undefined) return { groupe, ouverture: null };

    let courant: string | null = null;
    for (const point of ordonnes) {
      if (point.ordre > rang) break;
      courant = point.titre;
    }

    if (courant === null || courant === dernierRendu) return { groupe, ouverture: null };
    dernierRendu = courant;
    return { groupe, ouverture: courant };
  });
}
