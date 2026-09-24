// =============================================================================
// Le sommaire d'une séance : ce qui y a été examiné, et ce qui y a été voté
// =============================================================================
//
// LE PROBLÈME. Une séance publique n'a pas d'ordre du jour en base : la colonne
// `odj_resume` est vide sur les 926 séances de l'Assemblée. Son ordre du jour
// est dans le compte rendu, dispersé au fil de 1 600 prises de parole — la
// présidence l'annonce au micro (« L'ordre du jour appelle… ») et on passe au
// point suivant deux cents paragraphes plus loin. Le lecteur qui arrive sur la
// page ne voit donc qu'un mur de texte, sans savoir ce que la journée a traité
// ni ce qu'elle a voté.
//
// CE QU'ON EN FAIT. On recompose le sommaire : un point par annonce de la
// présidence, dans l'ordre, avec les textes discutés et les votes tombés sous
// chacun. C'est l'index de la séance, à déplier — le débat complet reste
// dessous.
//
// DEUX SOURCES, DEUX QUALITÉS. Quand la présidence annonce ses points, le
// découpage est celui de la séance elle-même et le compte des prises de parole
// est exact. Sinon — c'est le cas de tout le Sénat, dont le compte rendu ne
// porte pas ces annonces — on se rabat sur les textes : un point par dossier
// vu dans le débat ou mis aux voix. Le découpage est alors une reconstitution,
// et on ne prétend pas compter les prises de parole d'un passage qu'on n'a pas
// su délimiter : `nbPrises` vaut `null`.
// =============================================================================

/** Une annonce de la présidence, située par son rang dans le compte rendu. */
export interface AnnonceDeSeance {
  ordre: number;
  titre: string;
}

/** Ce qu'il faut d'une prise de parole pour la rattacher à un point. */
export interface PriseSituee {
  ordre: number | null;
  dossierId: string | null;
}

/**
 * Le texte législatif tel qu'on le nomme dans le sommaire.
 *
 * PAS `titreCourt` : il porte un code sur la plupart des dossiers, pas un titre
 * court. `procedureLibelle` sert à recomposer l'intitulé, dont le `titre` ne
 * garde que la suite (« relative à l'organisation… »).
 */
export interface DossierBref {
  id: string;
  uid: string;
  titre: string;
  procedureLibelle: string | null;
}

/** Ce qu'il faut d'un vote pour le rattacher à un point. */
export interface VoteSitue {
  id: string;
  dossierId: string | null;
}

export interface EntreeDeSommaire<S extends VoteSitue> {
  /** Stable au sein d'une séance : sert de clé de rendu. */
  cle: string;
  /**
   * D'où vient ce point : `annonce` s'il est prononcé par la présidence,
   * `dossier` s'il est reconstitué autour d'un texte, `autres` pour les votes
   * qu'aucun point n'a su réclamer. L'affichage n'a pas à le deviner.
   */
  source: 'annonce' | 'dossier' | 'autres';
  /** L'intitulé du point ; pour un texte, à recomposer avec `procedureLibelle`. */
  titre: string;
  /**
   * Le rang de la prise de parole qui ouvre le point, quand la présidence l'a
   * annoncé. `null` pour un point reconstitué à partir des seuls textes.
   */
  ordre: number | null;
  dossiers: DossierBref[];
  /** Le nombre de prises de parole du passage, ou `null` si on l'ignore. */
  nbPrises: number | null;
  scrutins: S[];
}

export interface SourcesDuSommaire<S extends VoteSitue> {
  annonces: AnnonceDeSeance[];
  prises: PriseSituee[];
  scrutins: S[];
  /** Le rang de la dernière prise de parole qui précède chaque vote, quand il est connu. */
  ordreDesVotes: Map<string, number>;
  dossiers: Map<string, DossierBref>;
}

/** Les votes qu'aucun point n'a su réclamer. */
const CLE_AUTRES = 'autres';

/**
 * Le sommaire d'une séance, dans l'ordre où elle s'est tenue.
 *
 * Rend un tableau vide quand la séance n'a ni annonce, ni texte identifié, ni
 * vote : mieux vaut pas de sommaire qu'un sommaire d'une seule ligne vide.
 */
export function sommaireDeSeance<S extends VoteSitue>(
  entree: SourcesDuSommaire<S>,
): EntreeDeSommaire<S>[] {
  const points =
    entree.annonces.length > 0
      ? pointsAnnonces(entree)
      : pointsReconstitues(entree);

  return points.filter(
    (point) => point.scrutins.length > 0 || point.dossiers.length > 0 || (point.nbPrises ?? 0) > 0,
  );
}

/**
 * Le découpage tel que la présidence l'a prononcé.
 *
 * Chaque annonce ouvre un point qui court jusqu'à la suivante. Les formalités
 * d'ouverture — appel, procès-verbal — précèdent la première annonce : elles
 * sont versées au premier point plutôt que de fonder un point à elles seules,
 * qui n'aurait ni titre ni contenu.
 */
function pointsAnnonces<S extends VoteSitue>(
  entree: SourcesDuSommaire<S>,
): EntreeDeSommaire<S>[] {
  const annonces = [...entree.annonces].sort((a, b) => a.ordre - b.ordre);
  const points: EntreeDeSommaire<S>[] = annonces.map((annonce) => ({
    cle: `annonce:${annonce.ordre}`,
    source: 'annonce' as const,
    titre: annonce.titre,
    ordre: annonce.ordre,
    dossiers: [],
    nbPrises: 0,
    scrutins: [],
  }));

  /** Le point en vigueur à ce rang : le dernier annoncé avant lui. */
  const pointAuRang = (rang: number): EntreeDeSommaire<S> => {
    let courant = points[0]!;
    for (let i = 0; i < annonces.length; i++) {
      if (annonces[i]!.ordre > rang) break;
      courant = points[i]!;
    }
    return courant;
  };

  const dossiersParPoint = new Map<string, Set<string>>();
  const retenirDossier = (point: EntreeDeSommaire<S>, dossierId: string | null) => {
    if (!dossierId) return;
    const vus = dossiersParPoint.get(point.cle) ?? new Set<string>();
    dossiersParPoint.set(point.cle, vus);
    if (vus.has(dossierId)) return;
    vus.add(dossierId);
    const dossier = entree.dossiers.get(dossierId);
    if (dossier) point.dossiers.push(dossier);
  };

  for (const prise of entree.prises) {
    if (prise.ordre === null) continue;
    const point = pointAuRang(prise.ordre);
    point.nbPrises = (point.nbPrises ?? 0) + 1;
    retenirDossier(point, prise.dossierId);
  }

  // Les votes situés d'abord : ils enrichissent la liste des textes de chaque
  // point, dont dépend le rattrapage des autres.
  const sansRang: S[] = [];
  for (const scrutin of entree.scrutins) {
    const rang = entree.ordreDesVotes.get(scrutin.id);
    if (rang === undefined) {
      sansRang.push(scrutin);
      continue;
    }
    const point = pointAuRang(rang);
    point.scrutins.push(scrutin);
    retenirDossier(point, scrutin.dossierId);
  }

  // Sans rang, le texte est le seul lien possible : un vote sur le dossier
  // d'un point lui revient. Un vote qu'aucun point ne réclame est listé à part
  // plutôt que rattaché au hasard.
  const orphelins: S[] = [];
  for (const scrutin of sansRang) {
    const parTexte = scrutin.dossierId
      ? points.find((point) => dossiersParPoint.get(point.cle)?.has(scrutin.dossierId!))
      : undefined;
    if (parTexte) parTexte.scrutins.push(scrutin);
    else orphelins.push(scrutin);
  }

  return orphelins.length > 0 ? [...points, pointDesOrphelins(orphelins, points, entree)] : points;
}

/**
 * Le découpage reconstitué, texte par texte.
 *
 * Aucune annonce n'étant disponible, l'unité est le dossier législatif : un
 * point par texte discuté ou mis aux voix. L'ordre suit le débat quand une
 * prise de parole nomme le texte, et la numérotation des scrutins pour les
 * textes qu'on ne connaît que par leurs votes.
 */
function pointsReconstitues<S extends VoteSitue>(
  entree: SourcesDuSommaire<S>,
): EntreeDeSommaire<S>[] {
  /** Premier rang où le texte apparaît dans le débat ; à défaut, après tout le reste. */
  const premierRang = new Map<string, number>();
  for (const prise of entree.prises) {
    if (!prise.dossierId || prise.ordre === null) continue;
    const vu = premierRang.get(prise.dossierId);
    if (vu === undefined || prise.ordre < vu) premierRang.set(prise.dossierId, prise.ordre);
  }

  const ordreDesTextes: string[] = [];
  const voir = (dossierId: string | null) => {
    if (!dossierId || ordreDesTextes.includes(dossierId)) return;
    if (!entree.dossiers.has(dossierId)) return;
    ordreDesTextes.push(dossierId);
  };
  for (const prise of entree.prises) voir(prise.dossierId);
  for (const scrutin of entree.scrutins) voir(scrutin.dossierId);

  ordreDesTextes.sort(
    (a, b) => (premierRang.get(a) ?? Number.MAX_SAFE_INTEGER) - (premierRang.get(b) ?? Number.MAX_SAFE_INTEGER),
  );

  const points = ordreDesTextes.map((dossierId) => {
    const dossier = entree.dossiers.get(dossierId)!;
    return {
      cle: `dossier:${dossier.uid}`,
      source: 'dossier' as const,
      titre: dossier.titre,
      ordre: premierRang.get(dossierId) ?? null,
      dossiers: [dossier],
      // On n'a pas délimité de passage : compter les seules prises de parole
      // qui nomment le texte laisserait croire que la discussion s'y résume.
      nbPrises: null,
      scrutins: [] as S[],
    };
  });

  const parDossier = new Map(points.map((point) => [point.dossiers[0]!.id, point]));
  const orphelins: S[] = [];
  for (const scrutin of entree.scrutins) {
    const point = scrutin.dossierId ? parDossier.get(scrutin.dossierId) : undefined;
    if (point) point.scrutins.push(scrutin);
    else orphelins.push(scrutin);
  }

  return orphelins.length > 0 ? [...points, pointDesOrphelins(orphelins, points, entree)] : points;
}

/**
 * Le point de repli.
 *
 * « Autres votes » n'a de sens qu'à côté d'autres : quand aucun point n'a su
 * réclamer le moindre vote — c'est le cas de toute la 15e législature, dont les
 * prises de parole ne sont pas encore rattachées aux scrutins — il les porte
 * tous, et c'est ce qu'il annonce.
 */
function pointDesOrphelins<S extends VoteSitue>(
  orphelins: S[],
  places: EntreeDeSommaire<S>[],
  entree: SourcesDuSommaire<S>,
): EntreeDeSommaire<S> {
  const dossiers: DossierBref[] = [];
  const vus = new Set<string>();
  for (const scrutin of orphelins) {
    if (!scrutin.dossierId || vus.has(scrutin.dossierId)) continue;
    vus.add(scrutin.dossierId);
    const dossier = entree.dossiers.get(scrutin.dossierId);
    if (dossier) dossiers.push(dossier);
  }
  const seuls = places.every((point) => point.scrutins.length === 0);
  return {
    cle: CLE_AUTRES,
    source: 'autres' as const,
    titre: seuls ? 'Votes de la séance' : 'Autres votes',
    ordre: null,
    dossiers,
    nbPrises: null,
    scrutins: orphelins,
  };
}
