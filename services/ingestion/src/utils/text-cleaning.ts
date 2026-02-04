// =============================================================================
// Utilitaires de nettoyage de texte
// =============================================================================

/**
 * Nettoie les caractères Windows-1252 (CP1252) mal encodés en UTF-8.
 * Le dump SQL du Sénat contient des caractères CP1252 qui, lus comme UTF-8,
 * produisent des caractères de contrôle C1 (U+0080-U+009F).
 */
export function cleanWindows1252Artifacts(text: string): string {
  if (!text) return text;

  return text
    // Apostrophes typographiques mal encodées
    .replace(/\u0091/g, "'")  // CP1252 left single quote
    .replace(/\u0092/g, "'")  // CP1252 right single quote
    // Guillemets
    .replace(/\u0093/g, '"')  // CP1252 left double quote
    .replace(/\u0094/g, '"')  // CP1252 right double quote
    // Tirets
    .replace(/\u0096/g, '–')  // CP1252 en dash
    .replace(/\u0097/g, '—')  // CP1252 em dash
    // Points de suspension
    .replace(/\u0085/g, '...')  // CP1252 ellipsis
    // Supprimer les autres caractères de contrôle C1
    .replace(/[\u0080-\u009F]/g, '');
}

/**
 * Supprime le préfixe redondant avec le nom de l'orateur au début des interventions Sénat.
 *
 * Patterns gérés (avec espaces normaux ou insécables \u00A0) :
 * - "M. Prénom Nom. Texte"
 * - "Mme Prénom Nom. Texte"
 * - "Prénom Nom. Texte" (sans civilité)
 * - "Nom. Texte" (juste le nom)
 * - "Nom . Texte" (espace avant point)
 *
 * @param contenu - Le contenu de l'intervention
 * @param prenom - Le prénom de l'orateur (optionnel)
 * @param nom - Le nom de l'orateur
 * @returns Le contenu nettoyé
 */
export function removeOrateurPrefix(contenu: string, prenom?: string, nom?: string): string {
  if (!contenu || !nom) return contenu;

  // Échapper les caractères spéciaux regex dans le nom/prénom
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nomEscaped = escapeRegex(nom);
  const prenomEscaped = prenom ? escapeRegex(prenom) : null;

  // Espace(s) : normal ou insécable, un ou plusieurs
  const sp = '[\\s\\u00A0]+';
  // Espace(s) optionnel(s) avant le point
  const spOpt = '[\\s\\u00A0]*';

  const patterns: RegExp[] = [];

  // 1. Avec civilité + prénom + nom : "M. Prénom Nom." ou "Mme Prénom Nom."
  if (prenomEscaped) {
    patterns.push(new RegExp(`^M\\.${sp}${prenomEscaped}${sp}${nomEscaped}${spOpt}\\.${spOpt}`, 'i'));
    patterns.push(new RegExp(`^Mme\\.?${sp}${prenomEscaped}${sp}${nomEscaped}${spOpt}\\.${spOpt}`, 'i'));
  }

  // 2. Avec civilité + nom seul : "M. Nom." ou "Mme Nom."
  patterns.push(new RegExp(`^M\\.${sp}${nomEscaped}${spOpt}\\.${spOpt}`, 'i'));
  patterns.push(new RegExp(`^Mme\\.?${sp}${nomEscaped}${spOpt}\\.${spOpt}`, 'i'));

  // 3. Sans civilité : "Prénom Nom." ou "Prénom Nom ."
  if (prenomEscaped) {
    patterns.push(new RegExp(`^${prenomEscaped}${sp}${nomEscaped}${spOpt}\\.${spOpt}`, 'i'));
  }

  // 4. Juste le nom : "Nom." ou "Nom ."
  patterns.push(new RegExp(`^${nomEscaped}${spOpt}\\.${spOpt}`, 'i'));

  // Essayer chaque pattern dans l'ordre (du plus spécifique au moins spécifique)
  for (const pattern of patterns) {
    if (pattern.test(contenu)) {
      return contenu.replace(pattern, '').trim();
    }
  }

  return contenu;
}
