// =============================================================================
// Lecture des fichiers de candidatures du ministère de l'Intérieur
// =============================================================================
//
// Le format change d'une édition à l'autre. Relevé en comparant les fichiers
// 2020 et 2023, feuille par feuille :
//
//   colonne              2020                          2023
//   ------------------   ---------------------------   -------------------------
//   département          « Code du département »       « Code département »
//   ordre de liste       « N° d'ordre dans la liste »  « Ordre dans la liste »
//   profession           2 colonnes (code, libellé)    1 colonne « (31) - … »
//   date de naissance    série Excel (23154)           texte (02/11/1950)
//   suppléant            « Nom Supp. »                 « Nom suppléant »
//   sortant              absente                       « Sortant » (OUI / vide)
//   ligne d'en-tête      ligne 2 (ligne 1 = titre)     ligne 1
//
// D'où le principe : **aucune colonne n'est lue par sa position**. Chaque champ
// déclare ses libellés possibles, normalisés (accents, casse, espaces), et le
// parser prend le premier présent. Une colonne inconnue est ignorée, une
// colonne absente donne une valeur nulle — jamais un décalage.
//
// Le fichier 2026 aura ses propres libellés. Ajouter un alias ici doit suffire.
// =============================================================================

import { enLignesObjets, normaliserEntete, serieExcelVersDate } from '../../utils/xlsx.js';
import type { FeuilleXlsx } from '../../utils/xlsx.js';
import { logger } from '../../utils/logger.js';

export type ModeScrutin = 'proportionnel' | 'majoritaire';
export type RoleCandidature = 'titulaire' | 'suppleant';

export interface CandidatBrut {
  ordre: number;
  role: RoleCandidature;
  nom: string;
  prenom: string;
  sexe: string | null;
  dateNaissance: Date | null;
  professionCode: string | null;
  professionLabel: string | null;
  /** `true` seulement si le fichier le dit ; l'édition 2020 n'a pas la colonne. */
  sortantDeclare: boolean;
  /**
   * Qualité déclarée au dépôt : `SEN`, `DEP`, `MAI`… Apparue en 2026, absente
   * avant. Sert à recouper le rattachement, jamais à le fonder.
   */
  codePersonnalite: string | null;
}

export interface ListeBrute {
  /** Code INSEE normalisé : `01`, `2A`, `973`, `997` pour l'étranger. */
  codeDepartement: string;
  libelleDepartement: string;
  modeScrutin: ModeScrutin;
  numeroDepot: number | null;
  /** Libellé de la liste ; `null` au scrutin majoritaire. */
  libelle: string | null;
  nuance: string | null;
  /** Libellé de la nuance tel que le ministère l'écrit ; absent avant 2026. */
  nuanceLibelle: string | null;
  candidats: CandidatBrut[];
}

// =============================================================================
// Résolution des colonnes
// =============================================================================

/**
 * Libellés acceptés pour chaque champ, du plus récent au plus ancien.
 *
 * Tous sont normalisés par `normaliserEntete` : minuscules, sans accents,
 * espaces réduits. Les libellés bruts d'origine figurent en commentaire quand
 * ils ne se devinent pas.
 */
const ALIAS = {
  codeDepartement: ['code circonscription', 'code departement', 'code du departement'],
  libelleDepartement: [
    'libelle circonscription',
    'circonscription',
    'libelle departement',
    'libelle du departement',
  ],
  numeroDepot: ['n° depot', 'n° depot liste', 'n° de depot du candidat'],
  libelleListe: ['libelle de la liste'],
  // L'ordre compte : en 2026 « Nuance de liste » porte le LIBELLÉ et « Code
  // nuance de liste » le code, alors qu'en 2020 « Nuance de liste » portait le
  // code. Chercher le code en premier donne la bonne colonne dans les deux cas.
  nuanceListe: ['code nuance de liste', 'nuance de liste'],
  nuanceCandidat: ['code nuance', 'nuance candidat'],
  // Libellé lisible de la nuance, fourni par le ministère à partir de 2026.
  // Le préférer à notre propre table, c'est citer la source plutôt que la
  // paraphraser.
  nuanceLibelle: ['nuance de liste', 'nuance du candidat'],
  ordre: ['ordre dans la liste', "n° d'ordre dans la liste", 'ordre'],
  sexe: ['sexe candidat', 'sexe du candidat', 'sexe'],
  nom: ['nom sur le bulletin de vote', 'nom candidat', 'nom du candidat'],
  prenom: ['prenom sur le bulletin de vote', 'prenom candidat', 'prenom du candidat'],
  dateNaissance: [
    'date de naissance candidat',
    'date naissance candidat',
    'date de naissance du candidat',
    'date de naissance',
  ],
  professionCode: ['code de la profession'],
  professionLabel: ['profession candidat', 'profession'],
  sortant: ['sortant'],
  /**
   * Qualité déclarée du candidat au moment du dépôt : `SEN` sénateur, `DEP`
   * député, `MAI` maire… Apparue en 2026. Sert de recoupement indépendant du
   * rattachement, jamais de source pour celui-ci.
   */
  codePersonnalite: ['code personnalite'],
  // En 2026 le suppléant est appelé « remplaçant ».
  sexeSuppleant: ['sexe remplacant', 'sexe suppleant', 'sexe supp.'],
  nomSuppleant: ['nom remplacant', 'nom suppleant', 'nom supp.'],
  prenomSuppleant: ['prenom remplacant', 'prenom suppleant', 'prenom supp.'],
  dateNaissanceSuppleant: [
    'date de naissance remplacant',
    'date de naissance suppleant',
    'date naiss. supp.',
  ],
} as const;

type Champ = keyof typeof ALIAS;

function lire(ligne: Record<string, string>, champ: Champ): string {
  for (const alias of ALIAS[champ]) {
    const valeur = ligne[alias];
    if (valeur !== undefined && valeur !== '') return valeur.trim();
  }
  return '';
}

// =============================================================================
// Normalisations
// =============================================================================

/**
 * Normalise un code de circonscription vers celui de la table
 * `circonscriptions`.
 *
 * Deux écarts à traiter : le fichier 2020 écrit `1` là où 2023 écrit `01`, et
 * les Français établis hors de France sont codés `ZZ` par le ministère quand
 * nous les stockons en `997`.
 */
export function normaliserCodeCirconscription(code: string): string {
  const brut = code.trim().toUpperCase();
  if (brut === '') return '';
  if (brut === 'ZZ') return '997';
  if (/^\d$/.test(brut)) return `0${brut}`;
  return brut;
}

/**
 * Lit une date de naissance, quelle que soit sa forme dans le fichier.
 *
 * `02/11/1950` en 2023, la série Excel `23154` en 2020. Une valeur purement
 * numérique est forcément une série : aucune date au format texte ne s'écrit
 * sans séparateur.
 */
export function lireDateNaissance(valeur: string): Date | null {
  const brut = valeur.trim();
  if (brut === '') return null;

  // Midi UTC dans les deux branches, pour la même raison que
  // `serieExcelVersDate` : minuit ferait reculer la date d'un jour à
  // l'affichage en heure locale française l'hiver.

  // ISO, format des fichiers 2026.
  const iso = brut.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso?.[1] && iso[2] && iso[3]) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12));
  }

  // Jour/mois/année, format du fichier 2023.
  const jourMoisAnnee = brut.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (jourMoisAnnee?.[1] && jourMoisAnnee[2] && jourMoisAnnee[3]) {
    const [, jour, mois, annee] = jourMoisAnnee;
    return new Date(Date.UTC(Number(annee), Number(mois) - 1, Number(jour), 12));
  }

  // Série Excel, format du fichier 2020.
  if (/^\d+(\.\d+)?$/.test(brut)) return serieExcelVersDate(Number(brut));

  logger.warn({ valeur: brut }, 'date de naissance illisible, candidature sans date');
  return null;
}

/**
 * Sépare le code INSEE de profession de son libellé.
 *
 * 2023 les fusionne dans une seule colonne (`(31) - Profession libérale`),
 * 2020 les donne séparément. On rend toujours les deux.
 */
export function lireProfession(
  codeColonne: string,
  libelleColonne: string
): { code: string | null; libelle: string | null } {
  const fusionnee = libelleColonne.match(/^\((\d+)\)\s*-\s*(.+)$/);
  if (fusionnee?.[1] && fusionnee[2]) {
    return { code: fusionnee[1], libelle: fusionnee[2].trim() };
  }

  return {
    code: codeColonne === '' ? null : codeColonne,
    libelle: libelleColonne === '' ? null : libelleColonne,
  };
}

/** `OUI` dans le fichier 2023 ; la colonne n'existe pas en 2020. */
function lireSortant(ligne: Record<string, string>): boolean {
  return lire(ligne, 'sortant').toUpperCase() === 'OUI';
}

function nombreOuNull(valeur: string): number | null {
  if (valeur === '') return null;
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? nombre : null;
}

// =============================================================================
// Analyse d'un classeur
// =============================================================================

/**
 * Reconnaît le mode de scrutin d'une feuille.
 *
 * Par son nom d'abord (« Scrutin proportionnel » / « Scrutin majoritaire »,
 * stable depuis 2020), et à défaut par son schéma : seul le proportionnel
 * porte un libellé de liste. Se fier au seul ordre des feuilles serait plus
 * fragile qu'utile.
 */
export function reconnaitreModeScrutin(feuille: FeuilleXlsx, entetes: string[]): ModeScrutin | null {
  const nom = normaliserEntete(feuille.nom);
  if (nom.includes('proportionnel')) return 'proportionnel';
  if (nom.includes('majoritaire')) return 'majoritaire';

  if (ALIAS.libelleListe.some(alias => entetes.includes(alias))) return 'proportionnel';
  if (ALIAS.nomSuppleant.some(alias => entetes.includes(alias))) return 'majoritaire';

  return null;
}

/**
 * Trouve la ligne d'en-tête d'une feuille.
 *
 * 2020 place un titre en première ligne et l'en-tête en deuxième, 2023 met
 * l'en-tête d'emblée. On cherche donc la première ligne qui contient le code
 * du département, plutôt que de coder en dur un index par édition.
 */
export function trouverLigneEntete(feuille: FeuilleXlsx): number {
  const limite = Math.min(feuille.lignes.length, 10);

  for (let index = 0; index < limite; index += 1) {
    const cellules = (feuille.lignes[index] ?? []).map(normaliserEntete);
    if (ALIAS.codeDepartement.some(alias => cellules.includes(alias))) return index;
  }

  return 0;
}

/**
 * Convertit un classeur en listes de candidature, tous scrutins confondus.
 *
 * Les feuilles dont le mode de scrutin n'est pas reconnaissable sont ignorées
 * avec un avertissement : un classeur peut porter des onglets annexes.
 */
export function analyserClasseurCandidatures(feuilles: FeuilleXlsx[]): ListeBrute[] {
  const listes: ListeBrute[] = [];

  for (const feuille of feuilles) {
    const ligneEntete = trouverLigneEntete(feuille);
    const entetes = (feuille.lignes[ligneEntete] ?? []).map(normaliserEntete);
    const mode = reconnaitreModeScrutin(feuille, entetes);

    if (!mode) {
      logger.warn({ feuille: feuille.nom }, 'feuille au mode de scrutin non reconnu, ignorée');
      continue;
    }

    const lignes = enLignesObjets(feuille, ligneEntete);
    listes.push(
      ...(mode === 'proportionnel' ? analyserProportionnel(lignes) : analyserMajoritaire(lignes))
    );
  }

  return listes;
}

/**
 * Au proportionnel, chaque ligne est un candidat : il faut regrouper par liste.
 *
 * La clef de regroupement est le numéro de dépôt quand le fichier le donne
 * (2020), sinon le libellé de la liste (2023, qui ne le donne pas). Deux
 * listes d'un même département ne peuvent pas porter le même libellé : la clef
 * reste discriminante dans les deux cas.
 */
function analyserProportionnel(lignes: Array<Record<string, string>>): ListeBrute[] {
  const parListe = new Map<string, ListeBrute>();

  for (const ligne of lignes) {
    const codeDepartement = normaliserCodeCirconscription(lire(ligne, 'codeDepartement'));
    const libelle = lire(ligne, 'libelleListe');
    const numeroDepot = nombreOuNull(lire(ligne, 'numeroDepot'));
    const clef = `${codeDepartement}|${numeroDepot ?? normaliserEntete(libelle)}`;

    let liste = parListe.get(clef);
    if (!liste) {
      liste = {
        codeDepartement,
        libelleDepartement: lire(ligne, 'libelleDepartement'),
        modeScrutin: 'proportionnel',
        numeroDepot,
        libelle: libelle === '' ? null : libelle,
        nuance: lire(ligne, 'nuanceListe') || null,
        nuanceLibelle: lire(ligne, 'nuanceLibelle') || null,
        candidats: [],
      };
      parListe.set(clef, liste);
    }

    const profession = lireProfession(lire(ligne, 'professionCode'), lire(ligne, 'professionLabel'));

    liste.candidats.push({
      // À défaut d'ordre explicite, le rang d'apparition : le fichier liste
      // les candidats dans l'ordre de la liste déposée.
      ordre: nombreOuNull(lire(ligne, 'ordre')) ?? liste.candidats.length + 1,
      role: 'titulaire',
      nom: lire(ligne, 'nom'),
      prenom: lire(ligne, 'prenom'),
      sexe: lire(ligne, 'sexe') || null,
      dateNaissance: lireDateNaissance(lire(ligne, 'dateNaissance')),
      professionCode: profession.code,
      professionLabel: profession.libelle,
      sortantDeclare: lireSortant(ligne),
      codePersonnalite: lire(ligne, 'codePersonnalite') || null,
    });
  }

  return [...parListe.values()];
}

/**
 * Au majoritaire, chaque ligne est un binôme titulaire + suppléant, donc une
 * unité de vote à elle seule.
 */
function analyserMajoritaire(lignes: Array<Record<string, string>>): ListeBrute[] {
  return lignes.map(ligne => {
    const profession = lireProfession(lire(ligne, 'professionCode'), lire(ligne, 'professionLabel'));

    const candidats: CandidatBrut[] = [
      {
        ordre: 1,
        role: 'titulaire',
        nom: lire(ligne, 'nom'),
        prenom: lire(ligne, 'prenom'),
        sexe: lire(ligne, 'sexe') || null,
        dateNaissance: lireDateNaissance(lire(ligne, 'dateNaissance')),
        professionCode: profession.code,
        professionLabel: profession.libelle,
        sortantDeclare: lireSortant(ligne),
        codePersonnalite: lire(ligne, 'codePersonnalite') || null,
      },
    ];

    const nomSuppleant = lire(ligne, 'nomSuppleant');
    if (nomSuppleant !== '') {
      candidats.push({
        ordre: 1,
        role: 'suppleant',
        nom: nomSuppleant,
        prenom: lire(ligne, 'prenomSuppleant'),
        sexe: lire(ligne, 'sexeSuppleant') || null,
        dateNaissance: lireDateNaissance(lire(ligne, 'dateNaissanceSuppleant')),
        // Le fichier ne donne ni profession ni qualité de sortant pour le
        // suppléant : ne rien inventer, surtout pas en recopiant le titulaire.
        professionCode: null,
        professionLabel: null,
        sortantDeclare: false,
        codePersonnalite: null,
      });
    }

    return {
      codeDepartement: normaliserCodeCirconscription(lire(ligne, 'codeDepartement')),
      libelleDepartement: lire(ligne, 'libelleDepartement'),
      modeScrutin: 'majoritaire',
      numeroDepot: nombreOuNull(lire(ligne, 'numeroDepot')),
      libelle: null,
      nuance: lire(ligne, 'nuanceCandidat') || null,
      nuanceLibelle: lire(ligne, 'nuanceLibelle') || null,
      candidats,
    };
  });
}

/**
 * Identifiant stable d'une unité de vote, pour rendre l'ingestion rejouable.
 *
 * Le numéro de dépôt quand il existe, le libellé normalisé sinon : c'est la
 * seule chose que le fichier offre de constant entre deux publications d'une
 * même édition (le ministère republie des versions corrigées).
 */
export function sourceUidListe(scrutin: string, liste: ListeBrute): string {
  const discriminant =
    liste.numeroDepot !== null
      ? `d${liste.numeroDepot}`
      : normaliserEntete(liste.libelle ?? '').replace(/[^a-z0-9]+/g, '-');

  return `${scrutin}:${liste.codeDepartement}:${liste.modeScrutin[0]}:${discriminant}`;
}
