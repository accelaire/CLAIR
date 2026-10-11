// =============================================================================
// Fiche IA d'un parlementaire : quand la régénérer, et quand la refuser
// =============================================================================
//
// Une fiche ne doit jamais rester en ligne une fois fausse. Jusqu'au 2026-10-11,
// seules les fiches neuves et 25 fiches tirées au sort chaque nuit parmi les
// élus en exercice étaient régénérées : un député devenu maire, un sénateur
// sorti ou un élu changé de groupe gardaient indéfiniment un texte au présent
// (« David Guiraud est un député français », sous le badge « Mandat terminé »).
//
// Deux pièces :
//
// - `signatureEditoriale` : l'empreinte des seuls faits qui, en changeant,
//   rendent le texte faux. La nuit, toute fiche dont l'empreinte diffère de
//   celle stockée est régénérée. Les statistiques d'activité n'y sont PAS : elles
//   bougent à chaque scrutin et feraient régénérer tout le parc chaque nuit. Le
//   prompt interdit donc de les citer, la page les affiche à jour.
// - `defautsBio` : les erreurs qu'une consigne ne suffit pas à empêcher et
//   qu'une regex sait voir (âge, durée qui court encore, chiffre d'activité,
//   mandat terminé au présent). Une fiche qui en porte n'est pas publiée.
// =============================================================================

import { computeContentHash } from './content-hash.js';
import { PROMPT_PARLEMENTAIRE_VERSION } from './prompts.js';

export interface SignatureEditorialeInput {
  nom: string;
  prenom: string;
  chambre: string;
  actif: boolean;
  groupe: string | null | undefined;
  commissionPermanente: string | null | undefined;
  circonscription: { departement: string | null; numero: number | null } | null | undefined;
  mandatsParlementaires: {
    chambre: string;
    legislature: number | null;
    mandature: number | null;
    dateDebut: Date;
    dateFin: Date | null;
  }[];
}

/**
 * Empreinte de ce que la fiche affirme sur la personne : son statut, sa chambre,
 * son groupe, sa commission, sa circonscription et ses mandats, plus la version
 * du prompt (une correction de consigne périme toutes les fiches écrites avant).
 *
 * Mandats en années seulement, comme dans le prompt : une date de fin corrigée
 * au jour près ne rend aucun texte faux.
 */
export function signatureEditoriale(p: SignatureEditorialeInput): string {
  const mandats = [...p.mandatsParlementaires]
    .sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())
    .map(m => [
      m.chambre,
      m.legislature ?? m.mandature ?? '',
      m.dateDebut.getUTCFullYear(),
      m.dateFin?.getUTCFullYear() ?? '',
    ].join(':'))
    .join(',');
  return computeContentHash(
    `v${PROMPT_PARLEMENTAIRE_VERSION}`,
    p.nom,
    p.prenom,
    p.chambre,
    p.actif ? 'actif' : 'ancien',
    p.groupe,
    p.commissionPermanente,
    p.circonscription ? `${p.circonscription.departement ?? ''}-${p.circonscription.numero ?? ''}` : '',
    mandats,
  );
}

// -----------------------------------------------------------------------------
// Défauts détectables
// -----------------------------------------------------------------------------

// Nombres écrits en lettres que le modèle emploie pour un âge ou une durée
// (« depuis près de trente ans », « vingt-cinq ans »). « vingt-cinq » est
// attrapé par « cinq ans ».
const NOMBRES_EN_LETTRES =
  'deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|quelques|plusieurs';

const NOMBRE_D_ANS = `(?:\\d+|${NOMBRES_EN_LETTRES})[\\s\\u00a0-]+ans(?![\\p{L}])`;

// Âge : faux une fois sur deux à l'écriture (soustraction ratée), faux de toute
// façon un an plus tard. « à 32 ans », « À seulement 22 ans », « âgé de 81 ans »,
// « Antoine Armand est un homme politique français de 33 ans ».
const AGE = new RegExp(
  `(?<![\\p{L}])à\\s+(?:seulement\\s+|peine\\s+|tout\\s+juste\\s+)?${NOMBRE_D_ANS}`
    + `|(?<![\\p{L}])âgée?s?\\s+de(?![\\p{L}])`
    + `|(?<![\\p{L}])(?:est|était)\\s+(?:un|une)\\s+[^.]{0,80}?(?<![\\p{L}])de\\s+${NOMBRE_D_ANS}`,
  'iu',
);

// Durée ouverte : « depuis plus de trente ans » est juste le jour de l'écriture
// et faux ensuite, comme un âge.
//
// Les durées de périodes closes (« sénateur pendant plus de vingt ans ») ne sont
// PAS refusées. Le prompt les déconseille, mais le modèle y revient même après
// trois essais (Alain Milon, 2004-2026, le 2026-10-11) : les refuser laissait
// en ligne une fiche bien plus fausse (« est un sénateur » pour un sortant).
const DUREE_OUVERTE = new RegExp(
  `(?<![\\p{L}])depuis\\s+(?:plus\\s+de\\s+|près\\s+de\\s+|presque\\s+|environ\\s+|bientôt\\s+)?${NOMBRE_D_ANS}`,
  'iu',
);

const ROLES_AN = 'députée?s?';
const ROLES_SENAT = 'sénat(?:eur|eurs|rice|rices)';

// `\b` ignore les lettres accentuées en JavaScript, même avec le drapeau `u` :
// « député » suivi d'une espace n'y finit pas un mot. D'où les assertions
// `(?![\p{L}])` en fin de motif.

/** « est (un|une|l'un des)… <rôle> », au présent, sans « ancien » intercalé. */
function presentDeRole(roles: string): RegExp {
  return new RegExp(
    `\\b(?:est|reste|demeure)\\s+(?:actuellement\\s+|aujourd['’]hui\\s+|toujours\\s+|désormais\\s+)?`
      + `(?:un\\s+|une\\s+|l['’]une?\\s+des\\s+)?(?:${roles})(?![\\p{L}])`
      // « est un député puis sénateur », « député devenu sénateur » : un parcours.
      + `(?!\\s+(?:puis|devenue?s?)(?![\\p{L}]))`,
    'iu',
  );
}

/** « siège à l'Assemblée », « siège au Sénat » : la présence dans une chambre. */
function siegeDans(chambre: 'assemblee' | 'senat'): RegExp {
  return chambre === 'senat'
    ? /\bsiège\s+(?:actuellement\s+|toujours\s+)?(?:au\s+Sénat|au\s+Palais\s+du\s+Luxembourg)/iu
    : /\bsiège\s+(?:actuellement\s+|toujours\s+)?(?:à\s+l['’]Assemblée|au\s+Palais\s+Bourbon)/iu;
}

// Chiffres d'activité : périmés au scrutin suivant, et affichés à jour par la
// page. « 148 amendements », « dont 21 ont été adoptés », « 26 % » de présence.
const CHIFFRE_ACTIVITE = new RegExp(
  // Sauf un score électoral (« 1,67 % des suffrages »), qui ne périme pas :
  // faux positif sur la fiche de Jean-Louis Roumegas le 2026-10-11.
  '\\d[\\d\\s\\u00a0.,]*\\s?%(?!\\s*des\\s+(?:suffrages|voix|exprimés|votants|inscrits))'
    + '|\\b\\d[\\d\\s\\u00a0]*\\s+(?:amendements?|votes?|scrutins?|interventions?|questions?|prises?\\s+de\\s+parole)\\b'
    + '|\\bdont\\s+\\d+\\s+(?:ont\\s+été\\s+)?adoptés?\\b',
  'iu',
);

export interface DefautsBioContexte {
  actif: boolean;
  chambre: string;
}

/** Extrait autour d'une correspondance, pour le journal et le message de retry. */
function extrait(texte: string, motif: RegExp): string | null {
  const m = motif.exec(texte);
  if (!m) return null;
  const debut = Math.max(0, m.index - 40);
  return texte.slice(debut, m.index + m[0].length + 40).replace(/\s+/g, ' ').trim();
}

/**
 * Défauts d'une fiche, en clair, prêts à être renvoyés au modèle. Vide si la
 * fiche peut être publiée.
 */
export function defautsBio(texte: string, ctx: DefautsBioContexte): string[] {
  const defauts: string[] = [];
  const signaler = (motif: RegExp, quoi: string) => {
    const e = extrait(texte, motif);
    if (e) defauts.push(`${quoi} : « …${e}… »`);
  };

  signaler(AGE, 'âge');
  signaler(DUREE_OUVERTE, 'durée qui court encore');
  signaler(CHIFFRE_ACTIVITE, "chiffre d'activité");

  const chambre = ctx.chambre === 'senat' ? 'senat' : 'assemblee';
  const autre = chambre === 'senat' ? 'assemblee' : 'senat';
  const roleDe = (c: 'assemblee' | 'senat') => (c === 'senat' ? ROLES_SENAT : ROLES_AN);

  if (!ctx.actif) {
    // Un ancien n'est plus rien au présent, dans aucune des deux chambres.
    signaler(presentDeRole(`${ROLES_AN}|${ROLES_SENAT}`), 'mandat terminé décrit au présent');
    signaler(siegeDans(chambre), 'mandat terminé décrit au présent');
    signaler(siegeDans(autre), 'mandat terminé décrit au présent');
  } else {
    // Un élu en exercice n'est pas, au présent, membre de l'autre chambre :
    // c'est la bio restée figée d'un député élu sénateur.
    signaler(presentDeRole(roleDe(autre)), "présenté au présent comme membre de l'autre chambre");
    signaler(siegeDans(autre), "présenté au présent comme membre de l'autre chambre");
  }

  return defauts;
}
