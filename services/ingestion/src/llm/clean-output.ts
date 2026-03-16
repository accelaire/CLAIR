// =============================================================================
// Nettoyage des sorties LLM — supprime markdown, préfixes de section, artefacts
// =============================================================================

/**
 * Nettoie une sortie LLM brute pour affichage texte pur.
 * Supprime : markdown bold/italic, préfixes numérotés, headers, bullet points.
 */
export function cleanLLMOutput(text: string): string {
  return text
    // Markdown bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Markdown italic *text* or _text_ (single)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    // Markdown headers ## Title
    .replace(/^#{1,4}\s+/gm, '')
    // Numbered section prefixes: "1. RÉSUMÉ :" or "2. POSITIONS :" etc.
    .replace(/^\d+\.\s*(RÉSUMÉ|POSITIONS?|ENJEUX|PARCOURS|FAITS NOTABLES?|TITRE)\s*[:：]\s*/gim, '')
    // Prefixed labels like "Fiche de synthèse :" or "Résumé :"
    .replace(/^(Fiche de synthèse|Résumé|En bref|Parcours|Positions? clés?|Faits notables?)\s*[:：]\s*/gim, '')
    // Bullet points at line start
    .replace(/^[-•]\s+/gm, '')
    // Multiple newlines → double
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
