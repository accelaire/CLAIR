// =============================================================================
// Pétitions citoyennes : lecture d'une ligne des jeux data.gouv.fr
// =============================================================================
//
// Les deux jeux (« Pétitions de l'Assemblée nationale », « Pétitions du Sénat »)
// sont produits par data.gouv.fr en relisant chaque semaine les pages des
// plateformes officielles (dépôt `datagouv/datagouvfr_data_pipelines`). Ce
// relevé a des limites mesurées le 22/11/2026, que la normalisation ne cache
// pas :
//
//  - le statut vaut « ouverte » par défaut, dès qu'aucun libellé n'est reconnu
//    sur la page : la n° 3014 (Duplomb) est « ouverte » alors que sa date
//    limite est passée et que son rapport existe. D'où `collecte`, qui croise
//    statut ET date limite, et le parcours, construit ailleurs ;
//  - la décision n'est captée que sous deux tournures : les n° 5158 et 6334
//    sont « classées » sans décision, alors que leur page la donne ;
//  - le texte est le `og:description` de la page : paragraphes aplatis,
//    tronqué vers 10 000 caractères (la n° 6711 s'arrête sur « bloqu »). Il
//    est remis en paragraphes (`texteLisible`), et signalé comme peut-être
//    incomplet au-delà de 9 800 caractères ;
//  - le compteur est un flottant (« 425.0 »), absent sur 22 pétitions AN, et
//    il baisse parfois d'une semaine à l'autre (signatures retirées).
//
// Module pur : aucun accès réseau ni base, de quoi le tester sur des lignes
// réelles.
// =============================================================================

export type ChambrePetition = 'assemblee' | 'senat';

/** Colonnes attendues, dans l'ordre. Un autre en-tête arrête la synchronisation. */
export const COLONNES_PETITIONS: Record<ChambrePetition, readonly string[]> = {
  assemblee: [
    'titre', 'description', 'date_publication', 'nb_votes', 'statut', 'date_limite_vote',
    'commission', 'legislature', 'decision_commission', 'url', 'identifiant',
  ],
  senat: [
    'titre', 'description', 'date_publication', 'nb_votes', 'statut', 'date_limite_vote',
    'type', 'url', 'identifiant',
  ],
};

/** Pétitions publiées par chaque plateforme, en clair dans l'URL de la page. */
export const HOTE_PLATEFORME: Record<ChambrePetition, string> = {
  assemblee: 'https://petitions.assemblee-nationale.fr',
  senat: 'https://petitions.senat.fr',
};

/**
 * Législature d'après le libellé « 2017-2022 » de la source, qui ne le donne
 * qu'aux pétitions archivées. Clé : l'année de début, qui distingue sans
 * ambiguïté les législatures dont la plateforme a gardé des pétitions (ouverte
 * en octobre 2020).
 */
const LEGISLATURE_PAR_ANNEE_DE_DEBUT: Record<string, number> = {
  '2017': 15,
  '2022': 16,
  '2024': 17,
};

/** Seuil de signatures d'une pétition « suivie » (indexable), dans les deux chambres. */
export const SEUIL_SUIVIE = 10_000;

/** Longueur visée de l'extrait exposé. */
const LONGUEUR_EXTRAIT = 300;

export type LigneSource = Record<string, string>;

export interface PetitionNormalisee {
  chambre: ChambrePetition;
  numero: number;
  titre: string;
  description: string;
  extrait: string;
  /** Le texte entier remis en paragraphes (cf. `texteLisible`). */
  texte: string;
  /** Texte assez long pour que la source l'ait coupé. */
  texteIncomplet: boolean;
  datePublication: Date;
  dateLimite: Date | null;
  signatures: number | null;
  statutSource: string;
  legislature: number | null;
  typeSource: string | null;
  commissionSource: string | null;
  decisionSource: string | null;
  url: string;
}

/** Une ligne refusée, avec la raison : remontée dans le rapport, jamais écrite. */
export class LigneInvalide extends Error {}

/** Vérifie l'en-tête du fichier. Lève si la source a changé de forme. */
export function verifierColonnes(chambre: ChambrePetition, colonnes: readonly string[]): void {
  const attendues = COLONNES_PETITIONS[chambre];
  const recues = colonnes.map((c) => c.replace(/^\uFEFF/, '').trim());
  if (recues.length !== attendues.length || recues.some((c, i) => c !== attendues[i])) {
    throw new Error(
      `Pétitions ${chambre} : colonnes inattendues (${recues.join(';')}), attendues ${attendues.join(';')}`,
    );
  }
}

/**
 * Les seules entités HTML présentes dans les fichiers (relevé du 22/11/2026 :
 * `&gt;` 119 fois, `&amp;` 78, `&lt;` 6), plus les formes numériques par
 * prudence. `&amp;` en dernier : `&amp;gt;` doit rester `&gt;`.
 */
export function decoderEntites(texte: string): string {
  return texte
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Texte d'affichage : entités décodées, BOM et espaces de largeur nulle
 * retirés, espaces insécables et blancs successifs ramenés à une espace.
 */
export function nettoyerTexte(brut: string): string {
  return decoderEntites(brut)
    .replace(/\uFEFF|\u200B|\u200C|\u200D|\u2060/g, '')
    .replace(/[\s\u00A0\u202F]+/g, ' ')
    .trim();
}

const COURRIEL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Numéros français, nationaux ou internationaux, groupés ou non (« 06 12 34 56 78 »,
// « 0612345678 », « +33 6 12 34 56 78 »). Ancré sur des non-chiffres pour ne
// pas mordre dans un montant ou une date.
const TELEPHONE = /(?<![\d+])(?:\+33[\s.]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}(?!\d)/g;

/** Masque courriels et numéros de téléphone : CLAIR n'a pas à les republier. */
export function masquerCoordonnees(texte: string): string {
  return texte.replace(COURRIEL, '[courriel masqué]').replace(TELEPHONE, '[téléphone masqué]');
}

/**
 * Rend l'espace que la source a perdue entre deux paragraphes. Le relevé de
 * data.gouv.fr retire les retours à la ligne sans les remplacer : « …des
 * Entreprises).En tant que… », « …fréquence publique :Des… ». Une ponctuation
 * de fin suivie d'une majuscule, après une minuscule, un chiffre, un signe
 * fermant ou l'espace qui précède « : ; ! ? », est une fin de paragraphe. Une initiale (« M.Dupont », « S.A. »)
 * suit une majuscule et reste telle quelle.
 */
export function recollerParagraphes(texte: string): string {
  // La typographie française espace avant « : ; ! ? » : « publique :Des ».
  return texte.replace(/([\p{Ll}\d)\]»"'’][.!?…:;]|\s[:;!?])(?=[\p{Lu}«])/gu, '$1 ');
}

// Abréviations suivies d'une majuscule sans fin de paragraphe : « (cf.Irvin
// Yalom », « article 61, al.2 ».
const ABREVIATIONS = /(?:^|[^\p{L}])(?:cf|al|art|chap|vol|pp?|n[o°]?)[.]$/iu;

// Mots qui ouvrent une phrase : collés sans ponctuation à un mot en minuscules
// (« inclusiveNous demandons »), à un titre en capitales (« EXPOSÉ DES
// MOTIFSLa facturation ») ou à une parenthèse (« (externe)Les »), ils marquent un
// retour à la ligne perdu. Liste fermée : « iPhone » ou « YouTube » n'y sont pas.
const DEBUT_DE_PHRASE =
  'Nous|Vous|Je|Il|Elle|Ils|Elles|On|Les|Le|La|Ces|Ce|Cette|Cela|Et|En|Pour|Dans|Que|Mais|Ainsi|Aujourd|' +
  'Depuis|Or|Donc|Par|Sur|Une|Un|Des|De|Si|Notre|Nos|Afin|Alors|Enfin|Madame|Monsieur|Mesdames|Article|Merci|Cordialement|' +
  'Aucun|Aucune|Tout|Toute|Tous|Toutes|Chaque|Lorsque|Considérant';
const COLLAGE = new RegExp(`(\\p{Ll}{3,}|\\p{Lu}{3,}|\\))(?=(?:${DEBUT_DE_PHRASE})(?!\\p{L}))`, 'gu');

/**
 * Le texte entier, remis en paragraphes, pour la fiche. La source a retiré
 * les retours à la ligne sans les remplacer ; chaque règle ci-dessous a été
 * vérifiée sur les jointures réelles du fichier :
 *  - une fin de phrase collée à une majuscule ouvre un paragraphe
 *    (« Entreprises).En tant que », 28 000 cas), un mot de début de phrase
 *    collé à une minuscule aussi (« inclusiveNous demandons », 2 750) ;
 *  - une virgule collée à une majuscule est une formule d'appel
 *    (« Messieurs les Députés,Nous, citoyens », 840) : une ligne ;
 *  - un titre de partie en chiffres romains (« bien-être. I - Dimanche »,
 *    160 cas) ouvre un paragraphe ;
 *  - listes numérotées (« principales :1.Des »), à puces (« • ») ou à tirets
 *    (« Cinéma- Audiovisuel- Théâtre », « Conséquences :- La ») : une ligne
 *    par élément.
 * Paragraphes séparés par une ligne vide, lignes par un retour simple.
 * Coordonnées masquées.
 */
export function texteLisible(brut: string): string {
  // Coordonnées masquées en dernier : « jean@exemple.fr.Merci » serait sinon
  // lu comme une seule adresse, et « Merci » masqué avec.
  const texte = nettoyerTexte(brut)
    // Séparateur « --- » (« Conseil constitutionnel---EXPOSÉ DES MOTIFS »).
    .replace(/\s*-{3,}\s*/g, '\n\n')
    // Titre de partie en chiffres romains, après une fin de phrase ou collé à
    // un mot : « bien-être. I - Dimanche », « gendarmerie.III- Contrôle »,
    // « transitoiresI. Les ». Pas après une majuscule (« P.I.B », « P.V. »)
    // ni après une espace sans ponctuation (« Louis XIV. Le roi »).
    .replace(
      /(?:((?<!\p{Lu})[.!?…:;)»"”])\s*|(\p{Ll}))(I{1,3}|IV|VI{0,3}|IX|X{1,3})\s*([-–.)])\s*(?=[\p{Lu}«])/gu,
      (_, ponctuation: string | undefined, lettre: string | undefined, chiffre: string, signe: string) =>
        `${ponctuation ?? lettre}\n\n${chiffre}${signe === '-' || signe === '–' ? ' – ' : `${signe} `}`,
    )
    .replace(/([.!?…:;])\s*(\d{1,2}(?:[.)]|\s*[-–]))\s*(?=[\p{Lu}«])/gu, (_, p: string, n: string) => `${p}\n${n.replace(/\s*[-–]$/, ' –')} `)
    .replace(/\s*•\s*/g, '\n• ')
    .replace(/([.!?…:;])-(?=\p{Lu})/gu, '$1\n– ')
    // Tiret collé au mot qui précède : « Cinéma- Audiovisuel ». Un tiret
    // espacé (« Article 7 – Sanctions ») reste dans la ligne, comme celui
    // d'un numéro (« 1- », « III- »).
    .replace(/(\S)(?<!(?:^|[^\p{L}\d])(?:\d{1,2}|[IVX]{1,4}))[-–]\s+(?=[\p{Lu}«])/gu, '$1\n– ')
    .replace(/(\p{Ll}),(?=\p{Lu})/gu, '$1,\n')
    .replace(COLLAGE, '$1\n\n');

  // Fin de phrase collée à une majuscule : nouveau paragraphe, sauf abréviation.
  const morceaux: string[] = [];
  let debut = 0;
  for (const m of texte.matchAll(/[\p{Ll}\d)\]»"'’][.!?…]+(?=[\p{Lu}«])/gu)) {
    const fin = m.index! + m[0].length;
    if (ABREVIATIONS.test(texte.slice(Math.max(0, fin - 8), fin))) continue;
    morceaux.push(texte.slice(debut, fin));
    debut = fin;
  }
  morceaux.push(texte.slice(debut));

  return morceaux
    .join('\n\n')
    .split(/\n{2,}/)
    .map((p) => p.split('\n').map((l) => masquerCoordonnees(recollerParagraphes(l.trim()))).filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Longueur au-delà de laquelle le texte de la source peut être coupé : le
 * relevé s'arrête vers 10 000 caractères (la n° 6711 finit sur « bloqu »).
 */
export const LONGUEUR_TEXTE_PEUT_ETRE_COUPE = 9_800;

/**
 * Début du texte, environ `LONGUEUR_EXTRAIT` caractères : jusqu'à la fin de la
 * dernière phrase qui tient s'il y en a une assez longue, sinon coupé sur un
 * mot, suivi de « … ». Coordonnées masquées.
 */
export function extraire(texte: string, longueur = LONGUEUR_EXTRAIT): string {
  const propre = masquerCoordonnees(recollerParagraphes(nettoyerTexte(texte)));
  if (propre.length <= longueur) return propre;

  const tete = propre.slice(0, longueur + 1);
  const finDePhrase = Math.max(tete.lastIndexOf('. '), tete.lastIndexOf('! '), tete.lastIndexOf('? '));
  if (finDePhrase >= longueur * 0.6) return tete.slice(0, finDePhrase + 1);

  const espace = tete.lastIndexOf(' ');
  const coupe = espace > longueur * 0.6 ? tete.slice(0, espace) : propre.slice(0, longueur);
  return `${coupe.replace(/[\s,;:.–-]+$/, '')}…`;
}

/** Date « AAAA-MM-JJ » de la source, en date civile UTC ; null si vide. */
export function lireDate(valeur: string | undefined): Date | null {
  const v = (valeur ?? '').trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) throw new LigneInvalide(`date illisible « ${v} »`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCDate() !== Number(m[3])) throw new LigneInvalide(`date impossible « ${v} »`);
  return d;
}

/** Compteur source : entier (Sénat) ou flottant entier (« 425.0 », AN) ; null si vide. */
export function lireSignatures(valeur: string | undefined): number | null {
  const v = (valeur ?? '').trim();
  if (!v) return null;
  if (!/^\d+(?:\.0+)?$/.test(v)) throw new LigneInvalide(`compteur illisible « ${v} »`);
  return Number.parseInt(v, 10);
}

/**
 * Législature d'une pétition de l'AN. La source ne la donne qu'aux pétitions
 * archivées ; une pétition non archivée relève de la législature en cours.
 */
export function legislatureAN(libelle: string, statut: string, legislatureCourante: number): number | null {
  const l = libelle.trim();
  if (l) {
    const debut = /^(\d{4})-\d{4}$/.exec(l)?.[1];
    return (debut && LEGISLATURE_PAR_ANNEE_DE_DEBUT[debut]) || null;
  }
  return statut === 'archivee' ? null : legislatureCourante;
}

/**
 * Collecte ouverte : la plateforme l'affiche ouverte ET la date limite n'est
 * pas passée. Le statut seul ne suffit pas (il vaut « ouverte » par défaut).
 */
export function collecte(statutSource: string, dateLimite: Date | null, aujourdhui: Date): 'ouverte' | 'close' {
  if (statutSource.toLowerCase() !== 'ouverte') return 'close';
  if (dateLimite && dateLimite.getTime() < jourUTC(aujourdhui).getTime()) return 'close';
  return 'ouverte';
}

/** La date civile UTC d'un instant. */
export function jourUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Forme de comparaison d'un libellé (titre de pétition, nom de commission) :
 * minuscules, apostrophes et guillemets typographiques ramenés, ponctuation et
 * tirets remplacés par une espace, blancs fusionnés. Les accents sont gardés :
 * deux titres ne sont « identiques » que s'ils s'écrivent pareil.
 */
export function formeComparable(libelle: string): string {
  return nettoyerTexte(libelle)
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Normalise une ligne. Lève `LigneInvalide` si un champ obligatoire manque ou
 * est illisible : la ligne n'est alors pas écrite, et le rapport le dit.
 */
export function normaliserLigne(
  chambre: ChambrePetition,
  ligne: LigneSource,
  legislatureCourante: number,
): PetitionNormalisee {
  const numeroBrut = (ligne.identifiant ?? '').trim();
  if (!/^\d+$/.test(numeroBrut)) throw new LigneInvalide(`identifiant illisible « ${numeroBrut} »`);
  const numero = Number(numeroBrut);

  const titre = nettoyerTexte(ligne.titre ?? '');
  if (!titre) throw new LigneInvalide(`n° ${numero} : titre vide`);

  const url = (ligne.url ?? '').trim();
  const urlAttendue = `${HOTE_PLATEFORME[chambre]}/initiatives/i-${numero}`;
  if (url !== urlAttendue) throw new LigneInvalide(`n° ${numero} : URL inattendue « ${url} »`);

  const datePublication = lireDate(ligne.date_publication);
  if (!datePublication) throw new LigneInvalide(`n° ${numero} : date de publication vide`);

  const statutSource = (ligne.statut ?? '').trim();
  if (!statutSource) throw new LigneInvalide(`n° ${numero} : statut vide`);

  const description = decoderEntites(ligne.description ?? '').replace(/^\uFEFF/, '').trim();
  const texteOuVide = (v: string | undefined) => {
    const t = nettoyerTexte(v ?? '');
    return t || null;
  };

  return {
    chambre,
    numero,
    titre,
    description,
    extrait: extraire(description),
    texte: texteLisible(description),
    texteIncomplet: description.length >= LONGUEUR_TEXTE_PEUT_ETRE_COUPE,
    datePublication,
    dateLimite: lireDate(ligne.date_limite_vote),
    signatures: lireSignatures(ligne.nb_votes),
    statutSource,
    legislature: chambre === 'assemblee'
      ? legislatureAN(ligne.legislature ?? '', statutSource, legislatureCourante)
      : null,
    typeSource: chambre === 'senat' ? texteOuVide(ligne.type) : null,
    commissionSource: chambre === 'assemblee' ? texteOuVide(ligne.commission) : null,
    decisionSource: chambre === 'assemblee' ? texteOuVide(ligne.decision_commission) : null,
    url,
  };
}
