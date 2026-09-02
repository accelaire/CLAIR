// =============================================================================
// Nuances politiques des candidats
// =============================================================================
//
// La nuance est attribuée par la préfecture, candidat par candidat, selon une
// grille annexée à une circulaire du ministère de l'Intérieur (pour 2023 :
// https://www.legifrance.gouv.fr/circulaire/id/45472). Elle est régulièrement
// contestée — le Conseil d'État a déjà fait réécrire une de ces circulaires.
//
// **Une nuance n'est pas un groupe politique.** Elle ne dit pas l'appartenance
// déclarée du candidat, elle dit le classement retenu par l'administration.
// Elle ne doit jamais être affichée comme « le groupe » ni comparée sans
// précaution au groupe sénatorial d'un sortant.
//
// Deux grilles coexistent dans un même fichier : une pour les candidats au
// scrutin majoritaire, une pour les listes au scrutin proportionnel. Les codes
// de liste sont le plus souvent le code individuel préfixé d'un `L`, mais pas
// toujours (`LUG`, `LUD`, `LUC`, `LENS` n'ont pas d'équivalent individuel, et
// `RDG` n'a pas d'équivalent en liste). On les énumère donc tous, sans règle
// de préfixe : une règle qui marche « le plus souvent » finirait par inventer
// une nuance qui n'existe pas.
//
// La grille bouge d'une élection à l'autre : 2020 codait `REM`/`LREM`, 2023
// code `REN`/`LREN`. D'où la règle de dégradation : un code inconnu ne reçoit
// AUCUNE famille et déclenche un avertissement — jamais une approximation.
// =============================================================================

/**
 * Regroupement large, repris du découpage en blocs que le ministère utilise
 * lui-même pour agréger ses résultats.
 *
 * À ne pas confondre avec `GroupePolitique.position`, l'échelle interne de
 * CLAIR (`gauche`, `centre_gauche`, `centre`, `droite`, `extreme_droite`) : ces
 * deux échelles n'ont ni la même granularité, ni le même objet. `position`
 * qualifie un groupe parlementaire réel, constitué et déclaré ; une famille
 * qualifie une étiquette administrative apposée à un candidat. Les tenir
 * séparées évite de faire dire à la seconde ce que seule la première établit —
 * on ne place pas ici LFI par rapport au PS, par exemple.
 */
export type FamillePolitique =
  | 'gauche'
  | 'centre'
  | 'droite'
  | 'extreme_droite'
  | 'regionaliste'
  | 'divers';

export interface Nuance {
  /** Code brut du fichier, tel quel. */
  code: string;
  /** Libellé lisible. */
  libelle: string;
  /** `null` quand le rattachement à un bloc serait un arbitrage éditorial. */
  famille: FamillePolitique | null;
}

/**
 * Toutes les nuances rencontrées dans les fichiers de candidatures des
 * sénatoriales 2020 et 2023, sans exception (42 codes).
 *
 * `famille: null` n'est pas un oubli, c'est un refus de trancher :
 * — `DLF` / `LDLF` (Debout la France), dont le placement entre droite et
 *   extrême droite est précisément l'objet du débat public sur le nuançage ;
 * — `DIV` / `LDIV`, la catégorie fourre-tout de la grille elle-même, qui ne
 *   désigne aucun bloc (elle reçoit la famille `divers`, ce qui est son sens,
 *   et non une position).
 */
const NUANCES: Record<string, { libelle: string; famille: FamillePolitique | null }> = {
  // --- Candidats au scrutin majoritaire -------------------------------------
  COM: { libelle: 'Parti communiste français', famille: 'gauche' },
  FI: { libelle: 'La France insoumise', famille: 'gauche' },
  SOC: { libelle: 'Parti socialiste', famille: 'gauche' },
  VEC: { libelle: 'Les Écologistes', famille: 'gauche' },
  ECO: { libelle: 'Écologistes divers', famille: 'gauche' },
  RDG: { libelle: 'Parti radical de gauche', famille: 'gauche' },
  DVG: { libelle: 'Divers gauche', famille: 'gauche' },
  DVC: { libelle: 'Divers centre', famille: 'centre' },
  MDM: { libelle: 'MoDem', famille: 'centre' },
  REM: { libelle: 'La République en marche', famille: 'centre' },
  REN: { libelle: 'Renaissance', famille: 'centre' },
  UDI: { libelle: 'Union des démocrates et indépendants', famille: 'centre' },
  HOR: { libelle: 'Horizons', famille: 'centre' },
  LR: { libelle: 'Les Républicains', famille: 'droite' },
  DVD: { libelle: 'Divers droite', famille: 'droite' },
  DLF: { libelle: 'Debout la France', famille: null },
  RN: { libelle: 'Rassemblement national', famille: 'extreme_droite' },
  EXD: { libelle: 'Extrême droite', famille: 'extreme_droite' },
  REG: { libelle: 'Régionaliste', famille: 'regionaliste' },
  DIV: { libelle: 'Divers', famille: 'divers' },

  // --- Listes au scrutin proportionnel --------------------------------------
  LCOM: { libelle: 'Liste Parti communiste français', famille: 'gauche' },
  LFI: { libelle: 'Liste La France insoumise', famille: 'gauche' },
  LSOC: { libelle: 'Liste Parti socialiste', famille: 'gauche' },
  LVEC: { libelle: 'Liste Les Écologistes', famille: 'gauche' },
  LECO: { libelle: 'Liste écologiste divers', famille: 'gauche' },
  LUG: { libelle: 'Liste union de la gauche', famille: 'gauche' },
  LDVG: { libelle: 'Liste divers gauche', famille: 'gauche' },
  LDVC: { libelle: 'Liste divers centre', famille: 'centre' },
  LMDM: { libelle: 'Liste MoDem', famille: 'centre' },
  LREM: { libelle: 'Liste La République en marche', famille: 'centre' },
  LREN: { libelle: 'Liste Renaissance', famille: 'centre' },
  LENS: { libelle: 'Liste Ensemble', famille: 'centre' },
  LUC: { libelle: 'Liste union du centre', famille: 'centre' },
  LUDI: { libelle: 'Liste Union des démocrates et indépendants', famille: 'centre' },
  LHOR: { libelle: 'Liste Horizons', famille: 'centre' },
  LLR: { libelle: 'Liste Les Républicains', famille: 'droite' },
  LUD: { libelle: 'Liste union de la droite', famille: 'droite' },
  LDVD: { libelle: 'Liste divers droite', famille: 'droite' },
  LDLF: { libelle: 'Liste Debout la France', famille: null },
  LRN: { libelle: 'Liste Rassemblement national', famille: 'extreme_droite' },
  LEXD: { libelle: 'Liste extrême droite', famille: 'extreme_droite' },
  LREG: { libelle: 'Liste régionaliste', famille: 'regionaliste' },
  LDIV: { libelle: 'Liste divers', famille: 'divers' },
};

/**
 * Résout un code de nuance.
 *
 * Rend `null` si le code est vide ; rend une nuance sans famille et sans
 * libellé résolu si le code est inconnu, de sorte qu'un code apparu en 2026
 * reste visible tel quel plutôt que d'être rangé de force dans un bloc.
 */
export function resoudreNuance(code: string | null | undefined): Nuance | null {
  const codeNettoye = (code ?? '').trim().toUpperCase();
  if (codeNettoye === '') return null;

  const connue = NUANCES[codeNettoye];
  if (!connue) return { code: codeNettoye, libelle: codeNettoye, famille: null };

  return { code: codeNettoye, libelle: connue.libelle, famille: connue.famille };
}

/** Vrai si le code n'est pas dans la grille — pour journaliser à l'ingestion. */
export function nuanceInconnue(code: string | null | undefined): boolean {
  const codeNettoye = (code ?? '').trim().toUpperCase();
  return codeNettoye !== '' && !(codeNettoye in NUANCES);
}

/** Codes couverts par la grille, pour les tests et les contrôles qualité. */
export function codesNuancesConnus(): string[] {
  return Object.keys(NUANCES);
}
